# bitbucket-pipelines-viewer-react

[![CI](https://github.com/eulolab/bitbucket-pipelines-viewer-react/actions/workflows/ci.yml/badge.svg)](https://github.com/eulolab/bitbucket-pipelines-viewer-react/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/bitbucket-pipelines-viewer-react.svg)](https://www.npmjs.com/package/bitbucket-pipelines-viewer-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![WCAG 2.2 AA](https://a11ybadges.com/badge?text=WCAG_2.2_AA&badgeColor=green)
![a11y tested](https://a11ybadges.com/badge?text=a11y_tested&badgeColor=green&logo=check-square)

Interactive React component for visualizing **bitbucket-pipelines.yml** configurations as flow graphs.

[**Live Demo**](https://eulolab.github.io/bitbucket-pipelines-viewer-react/)

## Features

- 📊 **Visual Flow**: Transforms complex YAML into an easy-to-understand directed acyclic graph (DAG).
- 🛠️ **Features**: Handles steps, parallel steps, stages, and manual triggers.
- 🎨 **Atlassian Design**: Built using `@atlaskit/tokens` for a seamless integration with Atlassian product aesthetics.
- 🔍 **Syntax Highlighting**: Built-in YAML preview with syntax highlighting.
- ⚡ **Performant**: Optimized for large pipeline configurations using `reactflow` and `dagre`.

## Installation

```bash
# Using npm
npm install bitbucket-pipelines-viewer-react

# Using pnpm
pnpm add bitbucket-pipelines-viewer-react

# Using yarn
yarn add bitbucket-pipelines-viewer-react
```

## Basic Usage

```tsx
import React from "react";
import { PipelinesViewer } from "bitbucket-pipelines-viewer-react";
import "bitbucket-pipelines-viewer-react/style.css";

const myYaml = `
pipelines:
  default:
    - step:
        name: Build and Test
        script:
          - npm install
          - npm test
    - step:
        name: Deploy
        trigger: manual
        script:
          - npm run deploy
`;

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <PipelinesViewer yaml={myYaml} />
    </div>
  );
}

export default App;
```

## Props

| Prop        | Type     | Description                                           | Default |
| :---------- | :------- | :---------------------------------------------------- | :------ |
| `yaml`      | `string` | The raw Bitbucket Pipelines YAML string to visualize. | `""`    |
| `className` | `string` | Optional CSS class name for the container.            | -       |

## Development

### Prerequisites

- Node.js 24+
- pnpm 10+

### Local Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/eulolab/bitbucket-pipelines-viewer-react.git
   cd bitbucket-pipelines-viewer-react
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the demo application:

   ```bash
   pnpm run dev
   ```

### Building

Build the library:

```bash
pnpm run build
```

Build the demo:

```bash
pnpm run build:demo
```

## License

MIT © [eulolab](https://github.com/eulolab)
