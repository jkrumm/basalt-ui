/** Seeded, deterministic model catalogue for expr-c16; the provider and model names are invented. */

export type Model = {
  id: string
  name: string
  provider: string
  /** Output speed, tokens per second. */
  speed: number
  /** USD per million input tokens. */
  inPrice: number
  /** USD per million output tokens. */
  outPrice: number
  /** Context window in thousands of tokens. */
  contextK: number
  vision: boolean
  tools: boolean
  reasoning: boolean
}

export type Chat = { inputTokens: number; outputTokens: number; images: number }

export type Fit = 'recommended' | 'current' | 'no-vision' | 'too-small' | 'ok'

export type Scenario = {
  chat: Chat
  models: readonly Model[]
  currentId: string
  recommendedId: string
}

const CHAT: Chat = { inputTokens: 212_000, outputTokens: 18_400, images: 14 }

const BASE: readonly Model[] = [
  m('alder-pro', 'Alder Pro', 'Alder', 62, 3, 15, 1000, true, true, true),
  m('alder-flash', 'Alder Flash', 'Alder', 188, 0.3, 2.5, 1000, true, true, false),
  m('alder-lite', 'Alder Lite', 'Alder', 241, 0.1, 0.4, 128, false, true, false),
  m('brine-4', 'Brine 4', 'Brine', 74, 2.5, 10, 400, true, true, true),
  m('brine-4-mini', 'Brine 4 mini', 'Brine', 156, 0.4, 1.6, 400, true, true, false),
  m('brine-reason', 'Brine Reason', 'Brine', 38, 8, 32, 200, true, true, true),
  m('cobalt-l', 'Cobalt L', 'Cobalt', 95, 1.25, 5, 2000, true, true, true),
  m('cobalt-s', 'Cobalt S', 'Cobalt', 301, 0.15, 0.6, 256, false, true, false),
]

function m(
  id: string,
  name: string,
  provider: string,
  speed: number,
  inPrice: number,
  outPrice: number,
  contextK: number,
  vision: boolean,
  tools: boolean,
  reasoning: boolean,
): Model {
  return { id, name, provider, speed, inPrice, outPrice, contextK, vision, tools, reasoning }
}

/** What the chat so far would have cost on `model`, in USD. */
export function chatCost(model: Model, chat: Chat): number {
  return (chat.inputTokens * model.inPrice + chat.outputTokens * model.outPrice) / 1_000_000
}

export const chatTokens = (chat: Chat): number => chat.inputTokens + chat.outputTokens

/** A model takes this chat when it reads images and its window holds every token so far. */
export function canTake(model: Model, chat: Chat): boolean {
  return model.vision && model.contextK * 1000 >= chatTokens(chat)
}

export function fitOf(model: Model, s: Scenario): Fit {
  if (model.id === s.recommendedId) return 'recommended'
  if (model.id === s.currentId) return 'current'
  if (!model.vision) return 'no-vision'
  if (model.contextK * 1000 < chatTokens(s.chat)) return 'too-small'
  return 'ok'
}

const byCost = (models: readonly Model[]): readonly Model[] =>
  [...models].sort((a, b) => chatCost(a, CHAT) - chatCost(b, CHAT))

/** Fixture names the scenario knows: default (undefined), `free` and `extreme`. */
export function scenarioFor(fixture: string | undefined): Scenario {
  if (fixture === 'free') {
    return {
      chat: CHAT,
      models: byCost([
        ...BASE,
        m('open-vl', 'Open VL', 'Cobalt', 52, 0, 0, 256, true, true, false),
      ]),
      currentId: 'alder-pro',
      recommendedId: 'open-vl',
    }
  }
  if (fixture === 'extreme') {
    return {
      chat: CHAT,
      models: byCost([
        ...BASE,
        m('alder-ultra', 'Alder Ultra', 'Alder', 14, 75, 300, 10_000, true, true, true),
      ]),
      currentId: 'alder-ultra',
      recommendedId: 'alder-flash',
    }
  }
  return { chat: CHAT, models: byCost(BASE), currentId: 'alder-pro', recommendedId: 'alder-flash' }
}

export const REASONS: Readonly<Record<string, string>> = {
  'alder-flash': 'Reads images, fits the chat, 3x faster',
  'open-vl': 'Reads images, fits the chat, runs free',
}
