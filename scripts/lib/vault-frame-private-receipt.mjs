import {spawn} from 'node:child_process';
import {lstat,realpath,access} from 'node:fs/promises';
import path from 'node:path';

// Only path metadata is inspected. Inputs/receipts must live outside Git and
// OneDrive; errors never interpolate a path or any payload.
export async function privateFilePath(filename, {mustExist = true} = {}) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw Error('PRIVATE_PATH_INVALID');
  const parent = await realpath(path.dirname(filename));
  const resolved = path.join(parent,path.basename(filename));
  if (parent.split(/[\\/]/).some(part=>/^onedrive(?:$|[ -])/i.test(part))) throw Error('PRIVATE_PATH_INVALID');
  for (const [key,value] of Object.entries(process.env)) {
    if (!/^onedrive/i.test(key) || !value) continue;
    const syncRoot = path.resolve(value).toLowerCase();
    const candidate = parent.toLowerCase();
    if (candidate === syncRoot || candidate.startsWith(syncRoot+path.sep)) throw Error('PRIVATE_PATH_INVALID');
  }
  for (let directory = parent;;directory = path.dirname(directory)) {
    let found = false; try { await access(path.join(directory,'.git')); found = true; }
    catch (error) { if (error.code !== 'ENOENT') throw Error('PRIVATE_PATH_INVALID'); }
    if (found) throw Error('PRIVATE_PATH_INVALID');
    if (path.dirname(directory) === directory) break;
  }
  let info; try { info = await lstat(resolved); } catch (error) { if (error.code !== 'ENOENT') throw Error('PRIVATE_PATH_INVALID'); }
  if (mustExist ? !info?.isFile() || info.isSymbolicLink() : Boolean(info)) throw Error('PRIVATE_PATH_INVALID');
  return resolved;
}
const protect = `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Security
  $payload = [Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
  $cipher = [Security.Cryptography.ProtectedData]::Protect($payload, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $check = [Security.Cryptography.ProtectedData]::Unprotect($cipher, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  if ($check.Length -ne $payload.Length) { throw 'RECEIPT_FAILED' }
  for ($i = 0; $i -lt $payload.Length; $i++) { if ($check[$i] -ne $payload[$i]) { throw 'RECEIPT_FAILED' } }
  $stream = [IO.File]::Open($env:VAULT_FRAME_RECEIPT_PATH, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($cipher, 0, $cipher.Length); $stream.Flush($true) } finally { $stream.Dispose() }
  $disk = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($env:VAULT_FRAME_RECEIPT_PATH), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  if ($disk.Length -ne $payload.Length) { throw 'RECEIPT_FAILED' }
  for ($i = 0; $i -lt $payload.Length; $i++) { if ($disk[$i] -ne $payload[$i]) { throw 'RECEIPT_FAILED' } }
  [Array]::Clear($payload, 0, $payload.Length)
  [Array]::Clear($check, 0, $check.Length)
  [Array]::Clear($disk, 0, $disk.Length)
} catch { exit 1 }
`;
export async function savePrivateClaimReceipt(filename, payload) {
  if (process.platform !== 'win32') throw Error('RECEIPT_PLATFORM_UNSUPPORTED');
  const destination = await privateFilePath(filename,{mustExist:false});
  const executable = path.join(process.env.SystemRoot || 'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  await new Promise((resolve,reject)=>{
    const child = spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',protect],{
      env:{...process.env,VAULT_FRAME_RECEIPT_PATH:destination},stdio:['pipe','ignore','ignore'],windowsHide:true
    });
    const timer = setTimeout(()=>{ child.kill(); reject(Error('RECEIPT_FAILED')); },15000);
    child.on('error',()=>{clearTimeout(timer);reject(Error('RECEIPT_FAILED'));});
    child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('RECEIPT_FAILED'));});
    child.stdin.on('error',()=>{clearTimeout(timer);child.kill();reject(Error('RECEIPT_FAILED'));});
    child.stdin.end(JSON.stringify(payload));
  });
}
