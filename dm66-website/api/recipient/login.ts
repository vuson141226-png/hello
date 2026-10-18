import { endpoint, json, readJson } from '../../server/http.js';
import { recipientLogin } from '../../server/recipient.js';

export default endpoint('POST', async (request, response) => {
  json(response, 200, await recipientLogin(request, response, await readJson(request)));
});
