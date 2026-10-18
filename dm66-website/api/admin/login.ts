import { endpoint, json, readJson } from '../../server/http.js';
import { login } from '../../server/auth.js';

export default endpoint('POST', async (request, response) => {
  json(response, 200, await login(request, response, await readJson(request)));
});
