// Verify the plugin against the REAL artifacts on disk, not fixtures:
//  - the three SKILL.md files installed at ~/.dsh/skills/patrol-*
//  - the exact body the live `skill` tool returned for patrol-write-test
//  - the host's real renderSkillContent output, captured from a session log
//
// Run from the plugin directory: node tests/test-live.mjs
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../index.js';
import { SKILL_NAMES, matchTrigger, renderSkillContentFallback } from '../trigger.js';

const SKILL_ROOT = join(homedir(), '.dsh', 'skills');

/** Captured verbatim from the live `skill` tool call in this project's session. */
const LIVE_SKILL_TOOL_OUTPUT = `<skill_content name="patrol-write-test">
<skill_resources>
Base directory for this skill: ${join(SKILL_ROOT, 'patrol-write-test')}
Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.
</skill_resources>

<skill_instructions>
# Order of actions when writing new tests

1. Inspect existing test code for functions that can be reused`;

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
};

/** Parse `--- frontmatter ---` out of a SKILL.md, the way the host does. */
function loadSkill(name) {
  const raw = readFileSync(join(SKILL_ROOT, name, 'SKILL.md'), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return {
    name,
    provider: 'filesystem',
    source: 'user-dsh',
    invocation: { modelInvocable: true, userInvocable: true },
    resourceBase: { kind: 'directory', path: join(SKILL_ROOT, name) },
    content: m ? raw.slice(m[0].length) : raw,
  };
}

console.log('=== the three skills are installed where the plugin looks ===');
for (const n of SKILL_NAMES) {
  check(existsSync(join(SKILL_ROOT, n, 'SKILL.md')), `${n}/SKILL.md exists`);
}

const skills = Object.fromEntries(SKILL_NAMES.map((n) => [n, loadSkill(n)]));

console.log('\n=== the injected body IS the real installed skill body ===');
{
  for (const prompt of [
    '用 Patrol 给登录页写一个 E2E 测试',
    'set up Patrol in this project',
    'structure our patrol_test/modules architecture',
  ]) {
    const listeners = new Map();
    apply({
      logger: { info: () => {}, warn: () => {} },
      on: (e, h) => listeners.set(e, h),
      skills: { get: async (n) => skills[n] },
    });

    const messages = [{ id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: prompt }] }];
    const out = await listeners.get('agent/pre-step')(
      { agent: { session: { header: { cwd: process.cwd() } } }, messages, signal: new AbortController().signal },
      async () => ({ kind: 'enter', messages }),
    );

    const routed = out.messages[1]?.source?.name;
    const body = out.messages[1]?.content?.[0]?.text ?? '';
    check(out.messages.length === 2, `[${routed}] injects exactly one message`);
    check(body.includes(`<skill_content name="${routed}">`), `[${routed}] wrapped in the real tag`);
    check(body.includes(skills[routed].content.trimEnd()), `[${routed}] body matches the file on disk`);
  }
}

console.log('\n=== matches what the live `skill` tool returned ===');
{
  // The live body is the installed file's content with its trailing newline
  // trimmed inside the wrapper, so the plugin's fallback must reproduce it.
  const rendered = renderSkillContentFallback(skills['patrol-write-test']);
  check(
    rendered.startsWith(LIVE_SKILL_TOOL_OUTPUT),
    'fallback renderer reproduces the live skill-tool output byte-for-byte',
  );
  if (!rendered.startsWith(LIVE_SKILL_TOOL_OUTPUT)) {
    for (let i = 0; i < LIVE_SKILL_TOOL_OUTPUT.length; i++) {
      if (rendered[i] !== LIVE_SKILL_TOOL_OUTPUT[i]) {
        console.log(`   first diff at ${i}:`);
        console.log(`     live : ${JSON.stringify(LIVE_SKILL_TOOL_OUTPUT.slice(i - 30, i + 30))}`);
        console.log(`     local: ${JSON.stringify(rendered.slice(i - 30, i + 30))}`);
        break;
      }
    }
  }
}

console.log('\n=== every routed skill resolves to a file on disk ===');
for (const prompt of [
  'set up Patrol in this project',
  'write a patrol test for login',
  'structure our patrol_test/modules architecture',
  '我们的 E2E 测试很不稳定',
  '接一下 patrol 到项目里',
  'install patrol and get a first test passing',
]) {
  const t = matchTrigger([{ source: { kind: 'user' }, content: [{ type: 'text', text: prompt }] }]);
  check(
    t !== undefined && existsSync(join(SKILL_ROOT, t.skill, 'SKILL.md')),
    `${JSON.stringify(prompt)} -> ${t?.skill ?? 'NO MATCH'}`,
  );
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
