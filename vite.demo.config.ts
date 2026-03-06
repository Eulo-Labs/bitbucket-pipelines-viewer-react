import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const posthogAnalyticsPlugin = (): Plugin => ({
  name: "posthog-analytics",
  transformIndexHtml(html) {
    if (process.env.NODE_ENV === "production") {
      return html.replace(
        "</head>",
        `  <script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing startSessionRecording stopSessionRecording sessionRecordingStarted loadToolbar get_property getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSurvey getSurveyResponse".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('phc_J2X92HQ8ZJxeSIhQhQigz2q3BBizadTvhNZsNNUZz97', {
      api_host: 'https://eu.i.posthog.com',
      autocapture: {
        element_allowlist: ['a', 'button', 'input', 'select'],
      },
      capture_pageview: true,
      capture_pageleave: true,
      capture_exceptions: true,
      disable_session_recording: true,
    });
  </script>
</head>`,
      );
    }
    return html;
  },
});

export default defineConfig({
  plugins: [react(), posthogAnalyticsPlugin()],
  root: "demo",
  base: "/bitbucket-pipelines-viewer-react/",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "demo/index.html"),
      },
    },
  },
});
