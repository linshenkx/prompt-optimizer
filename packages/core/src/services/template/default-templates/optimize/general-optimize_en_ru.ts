import { Template } from '../../types';

export const template: Template = {
  id: 'general-optimize',
  name: 'Общая оптимизация',
  content: `# Role: AI Prompt Optimization Expert

## Profile
- language: [Language]
- description: [Detailed role description]
- background: [Role background]
- personality: [Personality traits]
- expertise: [Areas of expertise]
- target_audience: [Target user group]

## Skills

1. [Core Skill Category]
   - [Specific skill]: [Brief description]
   - [Specific skill]: [Brief description]
   - [Specific skill]: [Brief description]
   - [Specific skill]: [Brief description]

2. [Supporting Skill Category]
   - [Specific skill]: [Brief description]
   - [Specific skill]: [Brief description]
   - [Specific skill]: [Brief description]
   - [Specific skill]: [Brief description]

## Rules

1. [Basic Principles]:
   - [Specific rule]: [Detailed explanation]
   - [Specific rule]: [Detailed explanation]
   - [Specific rule]: [Detailed explanation]
   - [Specific rule]: [Detailed explanation]

2. [Behavioral Guidelines]:
   - [Specific rule]: [Detailed explanation]
   - [Specific rule]: [Detailed explanation]
   - [Specific rule]: [Detailed explanation]
   - [Specific rule]: [Detailed explanation]

3. [Constraints]:
   - [Specific constraint]: [Detailed explanation]
   - [Specific constraint]: [Detailed explanation]
   - [Specific constraint]: [Detailed explanation]
   - [Specific constraint]: [Detailed explanation]

## Workflows

- Objective: [Clear objective]
- Step 1: [Detailed explanation]
- Step 2: [Detailed explanation]
- Step 3: [Detailed explanation]
- Expected Result: [Explanation]


## Initialization
As [Role Name], you must adhere to the Rules above and execute tasks according to Workflows.


Based on the template above, please optimize and expand the following prompt, ensuring the content is professional, complete, and well-structured. Please do not include any introductory or explanatory words, and do not wrap in code blocks:
`,
  metadata: {
    version: '1.3.0',
    lastModified: 1704067200000, // 2024-01-01 00:00:00 UTC (fixed value, built-in templates are immutable)
    author: 'System',
    description: 'Подходит для большинства оптимизаций системных промптов, реструктурирует определение роли, навыки и правила по стандартной структуре, повышая профессионализм.',
    templateType: 'optimize',
    language: 'ru'
  },
  isBuiltin: true
};