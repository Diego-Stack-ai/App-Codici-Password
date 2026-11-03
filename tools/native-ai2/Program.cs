using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;

const int PublicPort = 32145;
const int EnginePort = 32146;
const int MaximumRequestBytes = 128 * 1024;
const string ApiVersion = "0.1.0";

var allowedOrigins = new HashSet<string>(StringComparer.Ordinal)
{
    "https://appcodici-password.web.app",
    "https://appcodici-password.firebaseapp.com",
    "http://127.0.0.1:5000",
    "http://localhost:5000"
};

var localRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CodiciPassword", "AI2");
var dataRoot = Path.Combine(localRoot, "data");
var runtimeRoot = Path.Combine(localRoot, "runtime");
var modelRoot = Path.Combine(localRoot, "models");
Directory.CreateDirectory(dataRoot);
Directory.CreateDirectory(runtimeRoot);
Directory.CreateDirectory(modelRoot);

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls($"http://127.0.0.1:{PublicPort}");
builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = 0);
builder.Services.AddDataProtection()
    .SetApplicationName("CodiciPassword.Ai2.Host")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataRoot, "keys")))
    .ProtectKeysWithDpapi();
builder.Services.AddHttpClient("engine", client =>
{
    client.BaseAddress = new Uri($"http://127.0.0.1:{EnginePort}");
    client.Timeout = TimeSpan.FromMinutes(3);
});
builder.Services.AddSingleton(new HostPaths(localRoot, runtimeRoot, modelRoot));
builder.Services.AddSingleton<PairingStore>();
builder.Services.AddSingleton<EngineProcess>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<EngineProcess>());

var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Cross-Origin-Resource-Policy"] = "cross-origin";
    var origin = context.Request.Headers.Origin.ToString();
    if (string.IsNullOrEmpty(origin) || !allowedOrigins.Contains(origin))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    context.Response.Headers.AccessControlAllowOrigin = origin;
    context.Response.Headers.Vary = "Origin";
    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
        context.Response.Headers.AccessControlAllowHeaders = "Authorization, Content-Type";
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }
    await next();
});

app.MapGet("/v1/status", async (EngineProcess engine, HostPaths paths, CancellationToken cancellationToken) =>
{
    var drive = new DriveInfo(Path.GetPathRoot(paths.Root)!);
    return Results.Json(new
    {
        schemaVersion = 1,
        status = "available",
        version = ApiVersion,
        model = engine.ModelName,
        installed = engine.IsInstalled,
        ready = await engine.IsReady(cancellationToken),
        ramGiB = Math.Round(GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024d / 1024d / 1024d, 1),
        freeStorageBytes = drive.AvailableFreeSpace
    });
});

app.MapGet("/v1/health", async (HttpContext context, PairingStore pairing, EngineProcess engine,
    CancellationToken cancellationToken) =>
{
    if (!pairing.Authorize(context.Request.Headers.Authorization.ToString()))
        return Results.Json(new { code = "LOCAL_AI_NATIVE_PAIRING_REQUIRED" }, statusCode:401);
    var ready = await engine.EnsureReady(cancellationToken);
    return ready
        ? Results.Json(new { schemaVersion = 1, status = "ok", version = ApiVersion, model = engine.ModelName })
        : Results.Json(new { schemaVersion = 1, status = "loading", version = ApiVersion, model = engine.ModelName }, statusCode:503);
});

app.MapPost("/v1/pair", async (HttpContext context, PairingStore pairing, CancellationToken cancellationToken) =>
{
    var request = await ReadJson<PairRequest>(context.Request, cancellationToken);
    var origin = context.Request.Headers.Origin.ToString();
    if (request is null || request.SchemaVersion != 1 || !string.Equals(request.AppOrigin, origin, StringComparison.Ordinal)
        || !pairing.AcceptCode(request.Code))
    {
        return Results.Json(new { code = "LOCAL_AI_NATIVE_PAIRING_REJECTED" }, statusCode:403);
    }
    return Results.Json(new { schemaVersion = 1, token = pairing.Token, installId = pairing.InstallId });
});

app.MapPost("/v1/chat/completions", async (HttpContext context, PairingStore pairing, EngineProcess engine,
    IHttpClientFactory clients, CancellationToken cancellationToken) =>
{
    if (!pairing.Authorize(context.Request.Headers.Authorization.ToString()))
        return Results.Json(new { code = "LOCAL_AI_NATIVE_PAIRING_REQUIRED" }, statusCode:401);
    if (!engine.IsInstalled)
        return Results.Json(new { code = "LOCAL_AI_NATIVE_NOT_INSTALLED" }, statusCode:503);
    if (!await engine.EnsureReady(cancellationToken))
        return Results.Json(new { code = "LOCAL_AI_NATIVE_ENGINE_UNAVAILABLE" }, statusCode:503);
    if (context.Request.ContentLength is > MaximumRequestBytes)
        return Results.Json(new { code = "LOCAL_AI_NATIVE_REQUEST_TOO_LARGE" }, statusCode:413);

    using var body = await JsonDocument.ParseAsync(context.Request.Body,
        new JsonDocumentOptions { MaxDepth = 16 }, cancellationToken);
    if (!ValidChatRequest(body.RootElement))
        return Results.Json(new { code = "LOCAL_AI_NATIVE_REQUEST_INVALID" }, statusCode:400);

    using var upstream = new HttpRequestMessage(HttpMethod.Post, "/v1/chat/completions")
    {
        Content = new StringContent(body.RootElement.GetRawText(), Encoding.UTF8, "application/json")
    };
    upstream.Headers.Authorization = new AuthenticationHeaderValue("Bearer", engine.EngineApiKey);
    using var response = await clients.CreateClient("engine").SendAsync(upstream,
        HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    var payload = await response.Content.ReadAsStringAsync(cancellationToken);
    return Results.Content(payload, "application/json", Encoding.UTF8, (int)response.StatusCode);
});

var pairingStore = app.Services.GetRequiredService<PairingStore>();
Console.WriteLine($"Motore locale AI.2 in ascolto su 127.0.0.1:{PublicPort}");
Console.WriteLine($"Codice di associazione temporaneo: {pairingStore.PairCode}");
await app.RunAsync();

static async Task<T?> ReadJson<T>(HttpRequest request, CancellationToken cancellationToken)
{
    if (request.ContentLength is > MaximumRequestBytes) return default;
    try { return await request.ReadFromJsonAsync<T>(cancellationToken: cancellationToken); }
    catch (JsonException) { return default; }
}

static bool ValidChatRequest(JsonElement root)
{
    if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("messages", out var messages)
        || messages.ValueKind != JsonValueKind.Array || messages.GetArrayLength() is < 1 or > 14) return false;
    var total = 0;
    foreach (var message in messages.EnumerateArray())
    {
        if (message.ValueKind != JsonValueKind.Object || !message.TryGetProperty("role", out var role)
            || !message.TryGetProperty("content", out var content) || role.ValueKind != JsonValueKind.String
            || content.ValueKind != JsonValueKind.String) return false;
        if (role.GetString() is not ("system" or "user" or "assistant")) return false;
        total += content.GetString()?.Length ?? 0;
        if (total > 12_000) return false;
    }
    return !root.TryGetProperty("stream", out var stream) || stream.ValueKind == JsonValueKind.False;
}

sealed record PairRequest(int SchemaVersion, string Code, string AppOrigin);
sealed record HostPaths(string Root, string Runtime, string Models);

sealed class PairingStore
{
    private readonly string _token;
    private readonly byte[] _tokenBytes;
    private readonly byte[] _codeBytes;
    public string Token => _token;
    public string PairCode { get; }
    public string InstallId { get; }

    public PairingStore(IDataProtectionProvider provider, HostPaths paths)
    {
        var protector = provider.CreateProtector("pairing-token-v1");
        var tokenFile = Path.Combine(paths.Root, "data", "pairing-token.protected");
        _token = File.Exists(tokenFile)
            ? protector.Unprotect(File.ReadAllText(tokenFile, Encoding.UTF8))
            : Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        if (!File.Exists(tokenFile)) File.WriteAllText(tokenFile, protector.Protect(_token), Encoding.UTF8);
        _tokenBytes = Encoding.UTF8.GetBytes(_token);
        PairCode = RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();
        _codeBytes = Encoding.UTF8.GetBytes(PairCode);
        InstallId = Convert.ToHexString(SHA256.HashData(_tokenBytes))[..24].ToLowerInvariant();
    }

    public bool AcceptCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        var candidate = Encoding.UTF8.GetBytes(code.Trim());
        return candidate.Length == _codeBytes.Length && CryptographicOperations.FixedTimeEquals(candidate, _codeBytes);
    }

    public bool Authorize(string? authorization)
    {
        const string prefix = "Bearer ";
        if (string.IsNullOrEmpty(authorization) || !authorization.StartsWith(prefix, StringComparison.Ordinal)) return false;
        var candidate = Encoding.UTF8.GetBytes(authorization[prefix.Length..]);
        return candidate.Length == _tokenBytes.Length && CryptographicOperations.FixedTimeEquals(candidate, _tokenBytes);
    }
}

sealed class EngineProcess : BackgroundService
{
    private const int EnginePort = 32146;
    private readonly HostPaths _paths;
    private readonly IHttpClientFactory _clients;
    private readonly SemaphoreSlim _startLock = new(1, 1);
    private Process? _process;
    public string EngineApiKey { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    public string ModelName => "Qwen3-4B-GGUF";
    public bool IsInstalled => File.Exists(ServerPath) && File.Exists(ModelPath);
    private string ServerPath => Path.Combine(_paths.Runtime, "llama-server.exe");
    private string ModelPath => Path.Combine(_paths.Models, "qwen3-4b-q4_k_m.gguf");

    public EngineProcess(HostPaths paths, IHttpClientFactory clients) { _paths = paths; _clients = clients; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken); }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }

    private void StartEngine()
    {
        if (_process is { HasExited:false }) return;
        var start = new ProcessStartInfo(ServerPath)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = false,
            RedirectStandardOutput = false,
            Arguments = $"--model \"{ModelPath}\" --host 127.0.0.1 --port {EnginePort} --api-key {EngineApiKey} --ctx-size 4096 --threads {Math.Max(4, Environment.ProcessorCount / 2)} --no-webui --n-gpu-layers 0 --reasoning off --reasoning-budget 0"
        };
        _process = Process.Start(start);
    }

    public async Task<bool> EnsureReady(CancellationToken cancellationToken)
    {
        if (!IsInstalled) return false;
        if (await IsReady(cancellationToken)) return true;
        await _startLock.WaitAsync(cancellationToken);
        try
        {
            if (await IsReady(cancellationToken)) return true;
            StartEngine();
            var deadline = DateTimeOffset.UtcNow.AddMinutes(2);
            while (DateTimeOffset.UtcNow < deadline)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (await IsReady(cancellationToken)) return true;
                if (_process is null || _process.HasExited) return false;
                await Task.Delay(500, cancellationToken);
            }
            return false;
        }
        finally { _startLock.Release(); }
    }

    public async Task<bool> IsReady(CancellationToken cancellationToken)
    {
        if (!IsInstalled || _process is null || _process.HasExited) return false;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/v1/health");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", EngineApiKey);
            using var response = await _clients.CreateClient("engine").SendAsync(request, cancellationToken);
            return response.StatusCode == HttpStatusCode.OK;
        }
        catch (HttpRequestException) { return false; }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_process is { HasExited:false })
        {
            _process.Kill(true);
            await _process.WaitForExitAsync(cancellationToken);
        }
        _startLock.Dispose();
        await base.StopAsync(cancellationToken);
    }
}
