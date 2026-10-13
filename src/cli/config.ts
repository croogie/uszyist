export function readConfig(env: NodeJS.ProcessEnv = process.env): {token: string; dayTaskLabel: string} {
  const token = env.TODOIST_API_TOKEN;
  if (!token?.trim()) throw new Error('Set TODOIST_API_TOKEN to authenticate read-only Todoist queries.');
  const dayTaskLabel = env.USZYIST_DAY_TASK_LABEL ?? 'zadanie-dnia';
  if (!dayTaskLabel.trim()) throw new Error('USZYIST_DAY_TASK_LABEL must not be empty.');
  return {token, dayTaskLabel};
}
