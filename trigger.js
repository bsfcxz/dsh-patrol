/**
 * Trigger matching for the Patrol auto-invocation plugin.
 *
 * Patrol ships three official agent skills; this module decides which one (if
 * any) a step's direct user input is asking for, and renders the skill body in
 * the canonical `<skill_content>` shape.
 *
 * Kept free of Harness imports so it can be unit-tested with plain Node, and so
 * the vocabulary can be reviewed independently of the plugin wiring.
 *
 * @module dsh-patrol/trigger
 */

/** The setup skill: first-time Patrol installation in a project. */
export const SKILL_SETUP = 'patrol-setup';
/** The general skill: writing / editing / debugging Patrol E2E tests. */
export const SKILL_WRITE_TEST = 'patrol-write-test';
/** The specialized skill: LeanCode's Modules / System / ApiClients layout. */
export const SKILL_ARCHITECTURE = 'patrol-test-architecture';

/** Every skill this plugin can auto-load. */
export const SKILL_NAMES = [SKILL_SETUP, SKILL_WRITE_TEST, SKILL_ARCHITECTURE];

/**
 * Routed trigger table, **most specific first**.
 *
 * The router picks the first entry whose pattern matches, so ordering is the
 * routing policy: a step that asks for both "set up Patrol" and "architecture"
 * routes to setup because setup wins the earlier row.
 *
 * Matching is deliberately boundary-aware. `patrol` is an uncommon token, so a
 * bare mention is already a strong signal; the generic rows require the full
 * phrase (`integration test`, `ui test`) so that a plain "run the unit tests"
 * never drags a Flutter E2E framework into the turn.
 */
export const ROUTES = [
  {
    skill: SKILL_SETUP,
    patterns: [
      // "set up Patrol", "install patrol in this project", "add Patrol to the app"
      /\bpatrol\b[^.\n]{0,80}?\b(set ?up|setup|install(?:ing|ed)?|configure|configuring|add(?:ing)?|bootstrap|getting started|onboard)\b/i,
      /\b(set ?up|setup|install(?:ing|ed)?|configure|configuring|add(?:ing)?|bootstrap|onboard)\b[^.\n]{0,80}?\bpatrol\b/i,
      // "Patrol is not installed", "patrol isn't set up yet", "Patrol is missing here"
      /\bpatrol\b[^.\n]{0,80}?\b(?:not|isn'?t|aren'?t|never|missing)\b[^.\n]{0,40}?\b(?:installed|set ?up|configured|present|added|there|yet)\b/i,
      /\bpatrol\b[^.\n]{0,40}?\bmissing\b/i,
      // "this project has no Patrol yet", "a repo without Patrol"
      /\b(?:no|without|zero)\s+patrol\b/i,
      // Chinese: 安装/配置/接入/初始化/没有 Patrol — the verb may be separated
      // from "patrol" by a project name or a pasted repo URL, so allow a window
      // rather than only whitespace. ("安装这个 UI 测试插件 …/patrol" is a real
      // request shape seen in practice.)
      /(安装|配置|接入|初始化|引入|没有|未安装|还没有|setup|set ?up|install|add)[^。\n]{0,120}?(patrol|巡逻)/i,
      // Verb after the mention: "把 …/patrol 装到项目里", "patrol 的安装/配置"
      /(patrol|巡逻)[^。\n]{0,120}?(装到|安装|配置|接入|初始化|环境|接到)/i,
    ],
  },
  {
    skill: SKILL_ARCHITECTURE,
    patterns: [
      // "modular Patrol architecture", "Patrol test architecture with modules"
      /\bpatrol\b[^.\n]{0,80}?\b(architectur\w*|modular|modules?|page objects?|test wrapper)\b/i,
      /\b(architectur\w*|modular|modules?)\b[^.\n]{0,80}?\bpatrol\b/i,
      /\bpatrol_test\/(?:modules|system)\b/i,
      // Chinese: Patrol 测试架构 / 模块化（需带 patrol・flutter 上下文）
      /(patrol|flutter)[^。\n]{0,20}(架构|模块化|分层)/i,
      /(架构|模块化|分层)[^。\n]{0,20}(patrol|flutter)/i,
    ],
  },
  {
    skill: SKILL_WRITE_TEST,
    patterns: [
      // Any direct Patrol mention is enough.
      /\bpatrol\b/i,
      /\bpatrol_test\b/i,
      // Flutter end-to-end testing, named explicitly.
      /\bend[ -]?to[ -]?end\b/i,
      /\be2e\b/i,
      /\bintegration[ _-]?tests?\b/i,
      /\bui[ _-]?tests?\b/i,
      /\bui[ _-]?testing\b/i,
      /\bflutter[ _-]?drive\b/i,
      // Chinese equivalents.
      /端到端|集成测试|UI\s*测试|界面测试|巡检测试/,
    ],
  },
];

/**
 * Whether a text block asks for Patrol work, and which skill should answer.
 *
 * Only `source.kind === 'user'` counts, matching DSH's built-in `/skill-name`
 * gesture: plugin, tool, skill-injected, and subagent text can never trigger
 * this, so no other component can forge a match.
 *
 * @param messages - the step's claimed message batch.
 * @returns `{ skill, pattern, evidence }`, or undefined when nothing matched.
 */
export function matchTrigger(messages) {
  for (const message of messages) {
    if (message.source?.kind !== 'user') continue;
    for (const block of message.content ?? []) {
      if (block.type !== 'text' || typeof block.text !== 'string') continue;
      for (const route of ROUTES) {
        for (const pattern of route.patterns) {
          const found = block.text.match(pattern);
          if (found !== null) {
            return { skill: route.skill, pattern: pattern.source, evidence: found[0].slice(0, 80) };
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Whether this step already carries a Patrol skill body.
 *
 * A turn's later steps re-claim the earlier messages, so without this check the
 * body would be appended again on every step of the same turn. Any of the three
 * skills counts: routing to a sibling on a later step would still be a repeat
 * injection, and the model already holds the Patrol rules.
 *
 * @param messages - the step's claimed batch.
 * @returns whether a Patrol skill body is already present.
 */
export function alreadyInjected(messages) {
  return messages.some(
    (message) =>
      message.source?.kind === 'skill-invocation' &&
      SKILL_NAMES.includes(message.source?.name),
  );
}

/** Escape prose the way the host's skill renderer does, so framing tags survive. */
export function escapeText(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Escape a double-quoted attribute value. */
export function escapeAttr(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

/**
 * Render a skill in the canonical `<skill_content>` shape.
 *
 * Mirrors `renderSkillContent` from `@deepseek-ai/dsh-skill` so the injected
 * block is byte-identical to the one the `skill` tool produces. Used only when
 * that package cannot be resolved from this profile.
 *
 * @param skill - the loaded skill definition.
 * @returns the complete model-facing block.
 */
export function renderSkillContentFallback(skill) {
  const base = skill.resourceBase;
  let hint;
  if (base === undefined) {
    hint = [
      `Resources for this skill are managed by provider "${escapeText(skill.provider ?? 'unknown')}".`,
      'Load referenced resources only as needed.',
    ];
  } else if (base.kind === 'directory') {
    hint = [
      `Base directory for this skill: ${escapeText(base.path)}`,
      'Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.',
    ];
  } else if (base.kind === 'url') {
    hint = [
      `Base URL for this skill: ${escapeText(base.url)}`,
      'Resolve relative URLs mentioned by this skill against the base URL before using them. Load referenced resources only as needed.',
    ];
  } else {
    hint = [
      `Resources for this skill: ${escapeText(base.description)}`,
      'Load referenced resources only as needed.',
    ];
  }
  return [
    `<skill_content name="${escapeAttr(skill.name)}">`,
    '<skill_resources>',
    ...hint,
    '</skill_resources>',
    '',
    '<skill_instructions>',
    // The host trims the body before wrapping it — verified byte-for-byte
    // against two real host-rendered `skill_content` blocks captured from a
    // session log (one with a leading blank line, one without). A SKILL.md ends
    // with a newline and may begin with one after its frontmatter, so without
    // this the fallback would differ from the host output.
    skill.content.trim(),
    '</skill_instructions>',
    '</skill_content>',
  ].join('\n');
}
