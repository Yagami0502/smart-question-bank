const OpenAI = require('openai');

const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: { type: 'string' },
          type: { type: 'string', enum: ['MCQ', 'MULTI', 'TRUE_FALSE', 'FILL', 'SHORT_ANSWER'] },
          options: { type: 'array', items: { type: 'string' } },
          correctAnswer: {
            anyOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          explanation: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          difficulty: { type: 'integer', minimum: 1, maximum: 5 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          sourceIndex: { type: 'integer', minimum: 1 },
          sourceEvidence: {
            type: 'object',
            additionalProperties: false,
            properties: {
              sourceName: { type: 'string' },
              locator: { type: 'string' },
              excerpt: { type: 'string' },
              bbox: { type: 'array', items: { type: 'number', minimum: 0, maximum: 1000 }, minItems: 0, maxItems: 4 },
            },
            required: ['sourceName', 'locator', 'excerpt', 'bbox'],
          },
          needsReview: { type: 'boolean' },
          reviewReason: { type: 'string' },
        },
        required: ['content', 'type', 'options', 'correctAnswer', 'explanation', 'tags', 'difficulty', 'confidence', 'sourceIndex', 'sourceEvidence', 'needsReview', 'reviewReason'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['questions', 'summary'],
};

const REVIEW_SCHEMA = {
  ...QUESTION_SCHEMA,
  properties: {
    ...QUESTION_SCHEMA.properties,
    review: {
      type: 'object',
      additionalProperties: false,
      properties: {
        checked: { type: 'integer' },
        corrected: { type: 'integer' },
        notes: { type: 'array', items: { type: 'string' } },
      },
      required: ['checked', 'corrected', 'notes'],
    },
  },
  required: ['questions', 'summary', 'review'],
};

const PROMPTS = {
  parser: `你是 MindForge 的试题解析智能体。只负责忠实识别和切分题目，不要臆造缺失题干。按原始顺序从1开始设置sourceIndex。sourceEvidence必须记录来源文件名、可复查定位（文本行号、表格行号、Word段落或图片区域）、不超过80字的原文摘录；图片bbox使用0-1000归一化的[x1,y1,x2,y2]，非图片留空数组。识别题型、选项、原始答案与已有解析；没有答案或解析时保留空字符串。初始needsReview仅在原文模糊、截断或无法可靠辨认时为true并说明reviewReason。`,
  solver: `你是 MindForge 的学科解题智能体。逐题独立求解，补全或纠正correctAnswer，并生成面向学生的清晰题解。题解必须说明关键依据或步骤，选择题还要简要说明干扰项为什么不成立。完整保留sourceIndex和sourceEvidence。根据答案确定性设置confidence；题意不完整、存在多解或需要外部时效信息时设置needsReview=true并说明原因。`,
  reviewer: `你是 MindForge 的答案审校智能体。复核每道题的题型、答案和推导，修正确定存在的错误。完整保留sourceIndex和sourceEvidence。无法确定、题目有歧义或confidence低于0.82时必须设置needsReview=true并给出具体reviewReason，不要伪造确定性。保留有价值的详细题解，返回最终可导入题库的版本。`,
  challenger: `你是独立挑战解题智能体。你只会收到存在争议的题目。不要参考原答案的权威性，必须从题干重新独立推导答案，主动寻找反例、歧义和隐藏条件。完整保留sourceIndex和sourceEvidence，并输出你的候选答案、题解、confidence与reviewReason。`,
  arbitrator: `你是争议题裁决智能体。输入包含审校答案original和独立挑战答案challenger。逐题比较推导与证据，选择或修正最终答案。完整保留sourceIndex和sourceEvidence。若仍无法可靠裁决，needsReview必须为true且confidence不得高于0.69，并清楚说明需要人工确认的原因；达成可靠结论则可设needsReview=false。`,
};

function getClient(apiKey, baseURL) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    const error = new Error('未配置 OpenAI API Key，请在设置中填写或配置服务端 OPENAI_API_KEY');
    error.status = 400;
    throw error;
  }
  const configuredBaseURL = baseURL || process.env.OPENAI_BASE_URL;
  const normalizedBaseURL = configuredBaseURL
    ? `${configuredBaseURL.replace(/\/$/, '')}${/\/v1$/.test(configuredBaseURL.replace(/\/$/, '')) ? '' : '/v1'}`
    : undefined;
  return new OpenAI({
    apiKey: key,
    baseURL: normalizedBaseURL,
    maxRetries: 3,
    timeout: 90000,
  });
}

function imageInput(source) {
  return [{
    role: 'user',
    content: [
      { type: 'input_text', text: '识别图片中的全部试题。保持数学符号、题号和选项顺序。' },
      { type: 'input_image', image_url: source.dataUrl, detail: 'high' },
    ],
  }];
}

async function runQuestionAgent({ stage, payload, model, apiKey, baseURL }) {
  if (!PROMPTS[stage]) {
    const error = new Error('未知智能体阶段');
    error.status = 400;
    throw error;
  }

  const client = getClient(apiKey, baseURL);
  const isParserImage = stage === 'parser' && payload?.source?.kind === 'image';
  const input = isParserImage
    ? imageInput(payload.source)
    : JSON.stringify(stage === 'parser' ? payload.source : payload);
  const schema = stage === 'reviewer' ? REVIEW_SCHEMA : QUESTION_SCHEMA;
  const startedAt = Date.now();

  const response = await client.responses.create({
    model: model || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    instructions: PROMPTS[stage],
    input,
    text: {
      format: {
        type: 'json_schema',
        name: stage === 'reviewer' ? 'reviewed_question_set' : 'question_set',
        strict: true,
        schema,
      },
    },
  });

  if (!response.output_text) throw new Error('OpenAI 未返回可解析的结构化结果');
  const result = JSON.parse(response.output_text);
  return {
    result,
    trace: {
      stage,
      responseId: response.id,
      model: response.model,
      durationMs: Date.now() - startedAt,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      questionCount: result.questions.length,
      summary: result.summary,
    },
  };
}

module.exports = { runQuestionAgent, QUESTION_SCHEMA, REVIEW_SCHEMA };
