import React from "react";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export const oneDarkAccessible: Record<string, React.CSSProperties> = {
  ...oneDark,
  'code[class*="language-"]': {
    ...(oneDark['code[class*="language-"]'] as React.CSSProperties),
    textShadow: "none",
  },
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] as React.CSSProperties),
    textShadow: "none",
  },
  comment: { ...oneDark["comment"], color: "hsl(220, 10%, 65%)" },
  prolog: { ...oneDark["prolog"], color: "hsl(220, 10%, 65%)" },
  cdata: { ...oneDark["cdata"], color: "hsl(220, 10%, 65%)" },
  property: { ...oneDark["property"], color: "hsl(355, 65%, 70%)" },
  tag: { ...oneDark["tag"], color: "hsl(355, 65%, 70%)" },
  symbol: { ...oneDark["symbol"], color: "hsl(355, 65%, 70%)" },
  deleted: { ...oneDark["deleted"], color: "hsl(355, 65%, 70%)" },
  important: { ...oneDark["important"], color: "hsl(355, 65%, 70%)" },
};
