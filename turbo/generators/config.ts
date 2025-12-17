import type { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // Instrumentation Package Generator
  plop.setGenerator('instrumentation', {
    description: 'Create a new browser instrumentation package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message:
          "What API/feature are you instrumenting? (e.g., 'fetch', 'long-task', 'user-interaction')",
      },
      {
        type: 'input',
        name: 'description',
        message:
          'What is the package description? Please use a complete sentence.',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/package.json',
        templateFile: 'templates/instrumentation/package.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/src/index.ts',
        templateFile: 'templates/instrumentation/index.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/src/instrumentation.ts',
        templateFile: 'templates/instrumentation/instrumentation.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/src/instrumentation.test.ts',
        templateFile: 'templates/instrumentation/instrumentation.test.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/src/semconv.ts',
        templateFile: 'templates/instrumentation/semconv.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/src/types.ts',
        templateFile: 'templates/instrumentation/types.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/tsconfig.json',
        templateFile: 'templates/instrumentation/tsconfig.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/tsdown.config.ts',
        templateFile: 'templates/instrumentation/tsdown.config.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/README.md',
        templateFile: 'templates/instrumentation/README.md.hbs',
      },
    ],
  });
}
