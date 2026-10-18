import { endpoint, json } from '../../server/http.js';
import { recipientLogout } from '../../server/recipient.js';

export default endpoint('POST', async (request, response) => {
  json(response, 200, await recipientLogout(request, response));
});
