import type { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // SDK/Utilities Package Generator
  plop.setGenerator('sdk', {
    description: 'Create a new SDK or utility package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message:
          "What is the name of the package? (e.g., 'sdk-trace-web', 'context-zone')",
      },
      {
        type: 'input',
        name: 'description',
        message: 'What is the package description?',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'packages/{{kebabCase name}}/package.json',
        templateFile: 'templates/sdk/package.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{kebabCase name}}/src/index.ts',
        templateFile: 'templates/sdk/index.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{kebabCase name}}/tsconfig.json',
        templateFile: 'templates/shared/tsconfig.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{kebabCase name}}/README.md',
        templateFile: 'templates/sdk/README.md.hbs',
      },
    ],
  });

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
        message: 'What is the package description?',
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
        path: 'packages/instrumentation-{{kebabCase name}}/tsconfig.json',
        templateFile: 'templates/shared/tsconfig.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/instrumentation-{{kebabCase name}}/README.md',
        templateFile: 'templates/instrumentation/README.md.hbs',
      },
    ],
  });
}
