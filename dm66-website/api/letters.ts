import { endpoint, json, readJson } from '../server/http.js';
import { submitLetter } from '../server/letters.js';

export default endpoint('POST', async (request, response) => {
  const result = await submitLetter(request, await readJson(request));
  json(response, result.replayed ? 200 : 201, { letter: result.letter });
});
