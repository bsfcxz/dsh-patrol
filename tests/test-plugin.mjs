// Simulate the plugin's pre-step listener end to end with a stubbed context,
// so the wiring (not just the router) is exercised before installation.
// Run from the plugin directory: node tests/test-plugin.mjs
import { apply } from '../index.js';
import { alreadyInjected, SKILL_NAMES } from '../trigger.js';

const SKILLS = Object.fromEntries(
  SKILL_NAMES.map((n) => [
    n,
    {
      name: n,
      description: `${n} skill.`,
      provider: 'filesystem',
      source: 'user-dsh',
      invocation: { modelInvocable: true, userInvocable: true },
      resourceBase: { kind: 'directory', path: `/home/user/.dsh/skills/${n}` },
      content: `# ${n}\n\nPatrol rules body for ${n}.`,
    },
  ]),
);

/** Build a context that records the listener, the lookups it served, and logs. */
function makeCtx({ failLookup = false, missingSkill = false, nonUserInvocable = false } = {}) {
  const listeners = new Map();
  const logs = [];
  const lookups = [];
  return {
    logs,
    lookups,
    ctx: {
      on(event, handler) {
        listeners.set(event, handler);
      },
      logger: { info: (m) => logs.push(['info', m]), warn: (m) => logs.push(['warn', m]) },
      skills: {
        async get(name) {
          lookups.push(name);
          if (failLookup) throw new Error('registry offline');
          if (missingSkill) return undefined;
          const skill = SKILLS[name];
          if (skill === undefined) return undefined;
          return nonUserInvocable
            ? { ...skill, invocation: { modelInvocable: true, userInvocable: false } }
            : skill;
        },
      },
    },
    fire: (payload, next) => listeners.get('agent/pre-step')(payload, next),
  };
}

const userMsg = (text) => ({
  id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }],
});
const agent = { session: { header: { cwd: '/home/user/projects/my-flutter-app' } } };
const signal = new AbortController().signal;
const enter = (messages) => ({ kind: 'enter', messages, startsRequestSeries: true });

let failures = 0;
const check = (ok, label) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); };

// 1. Patrol request -> the routed body is spliced in, originals preserved.
for (const [prompt, expected] of [
  ['write a patrol test for login', 'patrol-write-test'],
  ['set up patrol in this project', 'patrol-setup'],
  ['structure our patrol_test/modules architecture', 'patrol-test-architecture'],
]) {
  const { ctx, fire, logs, lookups } = makeCtx();
  apply(ctx);
  const messages = [userMsg(prompt)];
  const out = await fire({ agent, messages, signal }, async () => enter(messages));
  check(out.kind === 'enter', `[${expected}] returns an enter decision`);
  check(out.messages.length === 2, `[${expected}] splices exactly one message`);
  check(out.messages[0] === messages[0], `[${expected}] keeps the original user message first`);
  const injected = out.messages[1];
  check(injected.source.kind === 'skill-invocation', `[${expected}] uses the skill-invocation source`);
  check(injected.source.name === expected, `[${expected}] names the routed skill`);
  check(lookups[0] === expected, `[${expected}] looked up the routed skill`);
  check(injected.content[0].text.includes('<skill_instructions>'), `[${expected}] renders the wrapper`);
  check(injected.content[0].text.includes(`Patrol rules body for ${expected}.`), `[${expected}] includes the body`);
  check(logs.some(([l]) => l === 'info'), `[${expected}] logs the auto-load`);
}

// 2. Unrelated request -> untouched, and no lookup is wasted.
{
  const { ctx, fire, lookups } = makeCtx();
  apply(ctx);
  const messages = [userMsg('run the unit tests')];
  const out = await fire({ agent, messages, signal }, async () => enter(messages));
  check(out.messages.length === 1, 'leaves an unrelated request unchanged');
  check(lookups.length === 0, 'does not touch the skill registry when nothing matched');
}

// 3. Already injected -> no duplicate on the next step of the same turn.
{
  const { ctx, fire } = makeCtx();
  apply(ctx);
  const messages = [userMsg('write a patrol test')];
  const first = await fire({ agent, messages, signal }, async () => enter(messages));
  check(first.messages.length === 2, 'first step injects');
  const second = await fire({ agent, messages: first.messages, signal }, async () => enter(first.messages));
  check(second.messages.length === 2, 'second step does not inject again');
  check(alreadyInjected(second.messages), 'guard reports the body present');
}

// 4. Rejected step -> untouched.
{
  const { ctx, fire } = makeCtx();
  apply(ctx);
  const messages = [userMsg('write a patrol test')];
  const out = await fire({ agent, messages, signal }, async () => ({ kind: 'reject' }));
  check(out.kind === 'reject', 'passes a reject decision through');
}

// 5. Registry failure -> fail-safe, no throw.
{
  const { ctx, fire, logs } = makeCtx({ failLookup: true });
  apply(ctx);
  const messages = [userMsg('write a patrol test')];
  const out = await fire({ agent, messages, signal }, async () => enter(messages));
  check(out.messages.length === 1, 'leaves the step unchanged when lookup throws');
  check(logs.some(([l]) => l === 'warn'), 'warns about the lookup failure');
}

// 6. Missing skill -> fail-safe.
{
  const { ctx, fire, logs } = makeCtx({ missingSkill: true });
  apply(ctx);
  const messages = [userMsg('write a patrol test')];
  const out = await fire({ agent, messages, signal }, async () => enter(messages));
  check(out.messages.length === 1, 'leaves the step unchanged when the skill is missing');
  check(logs.some(([l]) => l === 'warn'), 'warns about the missing skill');
}

// 7. user-invocable: false -> respected.
{
  const { ctx, fire } = makeCtx({ nonUserInvocable: true });
  apply(ctx);
  const messages = [userMsg('write a patrol test')];
  const out = await fire({ agent, messages, signal }, async () => enter(messages));
  check(out.messages.length === 1, 'respects user-invocable: false');
}

// 8. A wrapping listener's extra fields survive.
{
  const { ctx, fire } = makeCtx();
  apply(ctx);
  const messages = [userMsg('write a patrol test')];
  const out = await fire({ agent, messages, signal }, async () => enter(messages));
  check(out.startsRequestSeries === true, 'preserves other decision fields');
}

// 9. An aborted turn must not inject.
{
  const { ctx, fire } = makeCtx();
  apply(ctx);
  const controller = new AbortController();
  controller.abort();
  const messages = [userMsg('write a patrol test')];
  let threw = false;
  try {
    await fire({ agent, messages, signal: controller.signal }, async () => enter(messages));
  } catch {
    threw = true;
  }
  check(threw, 'aborts the injection when the turn signal is already aborted');
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
