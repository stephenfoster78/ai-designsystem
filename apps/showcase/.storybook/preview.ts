import type { Preview } from "@storybook/react-vite";
import "./storybook.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    // Fail the a11y panel (and test runner) on violations, not just warn.
    a11y: { test: "error" },
  },
};

export default preview;
