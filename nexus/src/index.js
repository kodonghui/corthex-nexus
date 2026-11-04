// Cloudflare Worker entry point. The page template is bundled as text (see
// the `rules` in wrangler.jsonc) and is a copy of the plugin's assets/hub.html.

import template from "./hub.html";
import { handle } from "./app.js";
import {createViews} from "./views.js";
import {code,entries} from "./view-code/manifest.js";

const views=createViews(code,entries);

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx, template,views);
  },
};
