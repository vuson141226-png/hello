import { endpoint, json } from '../../server/http.js';
import { recipientSession } from '../../server/recipient.js';

export default endpoint('GET', async (request, response) => {
  json(response, 200, await recipientSession(request, response));
});
