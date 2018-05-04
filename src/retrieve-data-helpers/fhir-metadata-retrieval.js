import queryString from 'query-string';
import axios from 'axios';
import { signalSuccessFhirServerRetrieval, signalFailureFhirServerRetrieval, setTestFhirServer } from '../actions/fhir-server-actions';
import store from '../store/store';

/**
 * Retrieve FHIR Server metadata from the /metadata endpoint and dispatch successful or failed connection.
 * @param testUrl - FHIR server in context
 * @returns {Promise} - Promise to resolve elsewhere
 */
function retrieveFhirMetadata(testUrl) {
  return new Promise((resolve, reject) => {
    let testFhirServer = testUrl;
    if (!testFhirServer) {
      const parsed = queryString.parse(window.location.search);
      testFhirServer = parsed.fhirServiceUrl ||
        localStorage.getItem('PERSISTED_fhirServer') ||
        store.getState().fhirServerState.defaultFhirServer;
    }
    const headers = { Accept: 'application/json' };
    store.dispatch(setTestFhirServer(testFhirServer));
    // Call metadata to check if there is a valid FHIR server, then hit a Patient endpoint to see
    // if the server is a secured endpoint (checking for 401 errors). If so, then the Sandbox triggers a face-up error to the
    // user that an open-launched Sandbox should be configured with an open FHIR endpoint
    axios({
      method: 'get',
      url: `${testFhirServer}/metadata`,
      headers,
    }).then((metadataResult) => {
      axios({
        method: 'get',
        url: `${testFhirServer}/Patient`,
        headers,
        validateStatus: status => status !== 401,
      }).then(() => {
        if (metadataResult.data && Object.keys(metadataResult.data).length) {
          store.dispatch(signalSuccessFhirServerRetrieval(testFhirServer, metadataResult.data));
          return resolve();
        }
        return reject();
      }).catch((err) => {
        if (err.response && err.response.status === 401) {
          console.error('Cannot use secured FHIR endpoint on an open-launched Sandbox. See https://github.com/cds-hooks/sandbox-2.0#testing-w-secured-fhir-servers' +
          ' for more details on testing the Sandbox against a secured FHIR endpoint.');
        } else {
          console.error('Could not connect to metadata endpoint of the FHIR server', err);
        }
        store.dispatch(signalFailureFhirServerRetrieval());
        return reject(err);
      });
    }).catch((err) => {
      console.error('Could not connect to metadata endpoint of the FHIR server', err);
      store.dispatch(signalFailureFhirServerRetrieval());
      return reject(err);
    });
  });
}

export default retrieveFhirMetadata;