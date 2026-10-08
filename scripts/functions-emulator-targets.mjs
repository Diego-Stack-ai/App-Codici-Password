// Smoke HTTP tests must refuse remote/default projects before any fetch.
export function functionsEmulatorTargets(env) {
  const project = env.GCLOUD_PROJECT;
  if (!/^demo-[a-z0-9-]+$/.test(project || '')) throw new Error('Explicit demo project required');
  const host = key => {
    const value = env[key];
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/.test(value || '')) {
      throw new Error(`Explicit loopback emulator required: ${key}`);
    }
    const port = Number(value.slice(value.lastIndexOf(':') + 1));
    if (port < 1 || port > 65535) throw new Error(`Invalid emulator port: ${key}`);
    return value;
  };
  const auth = host('FIREBASE_AUTH_EMULATOR_HOST');
  const functions = host('FUNCTIONS_EMULATOR_HOST');
  host('FIRESTORE_EMULATOR_HOST');
  return {project, authBase: `http://${auth}`, functionsBase: `http://${functions}/${project}/europe-west1`};
}
