// The forms of the path parameters of api/openapi.yaml (components.parameters and the schemas they name).
//
// The contract gives a value in another form "the 404 of what it names". So each route names, for each parameter of
// its path, the 404 code of what the parameter names, such as project_not_found or space_not_found for {project};
// the code gives the form, and a decoded value that is not in that form gets that code with its own detail, which
// never repeats the value. test/params.test.js checks the forms against the contract.

const ID = (prefix) => new RegExp(`^${prefix}_[0-9a-hjkmnp-tv-z]{12}$`);
const PROJECT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_NAME_LENGTH = 64;
// Event storming's steps in their order (the contract's Step, TERM-212), which the workshop's frames follow too.
export const STEPS = Object.freeze(['0', '1', '1-b', '2', '3', '4', '5', '6', '7', '8', '9']);

const projectName = (value) => value.length <= PROJECT_NAME_LENGTH && PROJECT_NAME.test(value);
const matching = (pattern) => (value) => pattern.test(value);

// The 404 code of what a parameter names → whether a value has the form of that thing.
export const FORMS = Object.freeze({
  project_not_found: projectName,
  space_not_found: projectName,
  comment_not_found: matching(ID('nc')),
  thread_not_found: matching(ID('nc')),
  proposal_not_found: matching(ID('np')),
  change_set_not_found: matching(ID('np')),
  edit_not_found: matching(ID('ne')),
  checkpoint_not_found: matching(ID('nk')),
  confirmation_not_found: matching(ID('nk')),
  entry_not_found: matching(/^n[cdek]_[0-9a-hjkmnp-tv-z]{12}$/),
  diagram_not_found: matching(ID('dg')),
  credential_not_found: matching(ID('ac')),
  tool_link_not_found: matching(ID('tl')),
  note_not_found: matching(ID('sn')),
  note_link_not_found: matching(ID('sl')),
  step_not_found: (value) => STEPS.includes(value),
});

// The code of the first parameter, in path order, whose value is not in the form its route names, or null when every
// one is. checks are [name, code] pairs, which the router builds from the route's path and params.
export function malformedParameter(checks, params) {
  for (const [name, code] of checks) {
    if (!FORMS[code](params[name])) return code;
  }
  return null;
}
