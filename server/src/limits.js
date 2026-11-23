// The limits of components.x-corthex.limits of api/openapi.yaml that the server checks in code, as the schema
// leaves them to it (db/nexus.sql). test/limits.test.js checks each against the contract.

export const LIMITS = Object.freeze({
  // A snapshot's body, API-242 (SPEC-001): 8 MiB.
  snapshotBytes: 8_388_608,
  // A Miro export's body, API-292: 5 MiB.
  miroBytes: 5_242_880,
  // Any other body: 2 MiB, the size of the hub's largest queued write.
  bodyBytes: 2_097_152,
  textCharacters: 4_000,
  nameCharacters: 200,
  credentialNameCharacters: 64,
  // How long a request key answers its first answer (rule 3): 7 days, because the hub keeps an unsent write that
  // long and sends it again under the same key; rule 3 asks for 24 hours.
  requestKeyDays: 7,
  claimMinutes: 60,
});
