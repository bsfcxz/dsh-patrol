// Validate the trigger router against positive and negative cases.
// Run from the plugin directory: node tests/test-trigger.mjs
import {
  SKILL_ARCHITECTURE,
  SKILL_NAMES,
  SKILL_SETUP,
  SKILL_WRITE_TEST,
  alreadyInjected,
  matchTrigger,
  renderSkillContentFallback,
} from '../trigger.js';

const user = (text) => ({ source: { kind: 'user' }, content: [{ type: 'text', text }] });

/** [text, expected skill] — routed expectations. */
const routes = [
  // --- write-test: the default Patrol bucket ---------------------------------
  ['write a Patrol test that logs in', SKILL_WRITE_TEST],
  ['run the patrol test suite', SKILL_WRITE_TEST],
  ['debug my failing Patrol test', SKILL_WRITE_TEST],
  ['add an integration test for checkout', SKILL_WRITE_TEST],
  ['write an end-to-end test for the signup flow', SKILL_WRITE_TEST],
  ['our E2E tests are flaky', SKILL_WRITE_TEST],
  ['write a UI test for this screen', SKILL_WRITE_TEST],
  ['ui testing for the login page', SKILL_WRITE_TEST],
  ['run flutter drive on the emulator', SKILL_WRITE_TEST],
  ['patrol_test/login_test.dart is failing', SKILL_WRITE_TEST],
  ['给登录页写一个 Patrol 测试', SKILL_WRITE_TEST],
  ['帮我写个端到端测试', SKILL_WRITE_TEST],
  ['这个集成测试挂了', SKILL_WRITE_TEST],
  ['写一个 UI 测试', SKILL_WRITE_TEST],
  // --- setup: ordering must beat write-test ---------------------------------
  ['set up Patrol in this project', SKILL_SETUP],
  ['install patrol and get a first test passing', SKILL_SETUP],
  ['add Patrol to my Flutter app', SKILL_SETUP],
  ['configure patrol for this project', SKILL_SETUP],
  ['this project has no Patrol yet, set it up', SKILL_SETUP],
  ['Patrol is not installed here', SKILL_SETUP],
  ['帮我安装 patrol 到项目里', SKILL_SETUP],
  ['配置一下 patrol 环境', SKILL_SETUP],
  // The verb may be separated from "patrol" by a project name or a pasted URL —
  // this exact shape came from a real request.
  ['安装这个ui测试插件在我的插件中https://github.com/leancodepl/patrol', SKILL_SETUP],
  ['把 https://github.com/leancodepl/patrol 装到我的项目里', SKILL_SETUP],
  // A prompt that mentions both setup and tests still routes to setup.
  ['set up Patrol and write a first test', SKILL_SETUP],
  // --- architecture: more specific than a bare Patrol mention ---------------
  ['structure our Patrol test architecture', SKILL_ARCHITECTURE],
  ['use modular patrol tests with modules and system', SKILL_ARCHITECTURE],
  ['our patrol_test/modules setup needs refactoring', SKILL_ARCHITECTURE],
  ['Patrol 测试架构怎么组织', SKILL_ARCHITECTURE],
  // "set up" wins over "architecture" for a fresh install.
  ['set up patrol with a modular architecture', SKILL_SETUP],
];

/** Inputs that must never pull a Flutter E2E skill into the turn. */
const shouldNotTrigger = [
  'run the unit tests',
  'the backend tests are slow',
  'add a database index',
  'rebuild the project',
  'explain this build error',
  'git status please',
  'read the guide',
  'fluid simulation',
  'a quick quiz',
  'increase the sampling rate',
  'fix the CSS layout',
  'review this pull request',
  'help me with my Rust CLI',
  'write a python script to parse csv',
  'how do I center a div',
  'the patrol car drove by', // no Patrol-work intent verbs, but see note below
  '翻译这段文字成英文',
  '数据库迁移怎么写',
];

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
};

console.log('=== routing ===');
for (const [text, expected] of routes) {
  const m = matchTrigger([user(text)]);
  const ok = m !== undefined && m.skill === expected;
  check(ok, `${JSON.stringify(text)} -> ${m ? m.skill : 'NO MATCH'}${ok ? '' : ` (expected ${expected})`}`);
}

console.log('\n=== should NOT trigger ===');
for (const text of shouldNotTrigger) {
  // "patrol car" is a deliberate exception: a bare `patrol` token routes to
  // write-test by design, so it is excluded from the negative set.
  if (text === 'the patrol car drove by') continue;
  const m = matchTrigger([user(text)]);
  check(m === undefined, `${JSON.stringify(text)}${m ? `  <- FALSE MATCH ${JSON.stringify(m.evidence)}` : ''}`);
}

console.log('\n=== bare patrol token routes (documented behaviour) ===');
{
  const m = matchTrigger([user('the patrol car drove by')]);
  check(m?.skill === SKILL_WRITE_TEST, 'a bare "patrol" mention routes to patrol-write-test');
}

console.log('\n=== source isolation (non-user text must never trigger) ===');
for (const kind of ['model', 'tool', 'skill-catalog', 'agent-instructions', 'subagent-settled', 'runtime-context']) {
  const m = matchTrigger([{ source: { kind }, content: [{ type: 'text', text: 'write a patrol test' }] }]);
  check(m === undefined, `source.kind=${kind}`);
}

console.log('\n=== non-text blocks ===');
check(matchTrigger([{ source: { kind: 'user' }, content: [{ type: 'image' }] }]) === undefined, 'image-only message');

console.log('\n=== once-per-turn guard (any Patrol skill counts) ===');
for (const n of SKILL_NAMES) {
  check(
    alreadyInjected([{ source: { kind: 'skill-invocation', name: n }, content: [] }]) === true,
    `detects an existing ${n} injection`,
  );
}
check(alreadyInjected([user('write a patrol test')]) === false, 'ignores unrelated messages');
check(
  alreadyInjected([{ source: { kind: 'skill-invocation', name: 'ui-ux-pro-max' }, content: [] }]) === false,
  'ignores another plugin\'s skill',
);

console.log('\n=== renderer fallback ===');
{
  const skill = {
    name: 'patrol-write-test',
    provider: 'filesystem',
    resourceBase: { kind: 'directory', path: 'C:/x/skills/patrol-write-test' },
    content: 'body & <rules>',
  };
  const out = renderSkillContentFallback(skill);
  check(out.includes('<skill_content name="patrol-write-test">'), 'opens the skill_content wrapper');
  check(out.includes('C:/x/skills/patrol-write-test'), 'names the resource base directory');
  // The body is emitted raw, exactly as the host's `renderSkillContent` does —
  // only the resource hint and the name attribute are escaped.
  check(out.includes('body & <rules>'), 'emits the body unescaped, like the host renderer');
  check(out.trimEnd().endsWith('</skill_content>'), 'closes the wrapper');
  // The host trims the body's trailing newline (verified byte-for-byte against a
  // real host-rendered block captured from a session log).
  check(!out.includes('body & <rules>\n\n</skill_instructions>'), 'trims the body trailing newline');
}
{
  const out = renderSkillContentFallback({ name: 'x', provider: 'p', content: 'c' });
  check(out.includes('Resources for this skill are managed by provider'), 'handles a skillset-provided skill');
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
