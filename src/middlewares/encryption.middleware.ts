import NodeRSA from 'node-rsa';
import fs from 'fs';
import path from 'path';

// --- Key Loading & Importing ---

const privateKeyPath = path.join(__dirname, '..', 'keys', 'private.pem');
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

const publicKeyPath = path.join(__dirname, '..', 'keys', 'public.pem');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

// Import keys using explicit PKCS8 format strings.
const rsa = new NodeRSA();
rsa.importKey(privateKey, 'pkcs8-private-pem');

const publicRsa = new NodeRSA();
publicRsa.importKey(publicKey, 'pkcs8-public-pem');

// Define encryption options using a string for the scheme.
const encryptionOptions = {
  encryptionScheme: {
    scheme: 'pkcs1_oaep', // using a string value
    hash: 'sha256'
  }
};

// --- Helper Function ---
// Checks if the given string appears to be a JWT token.
function isJWTToken(token: any): boolean {
  if (typeof token !== 'string') return false;
  // Basic regex to detect a JWT token (three parts separated by periods)
  const jwtRegex = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
  return jwtRegex.test(token);
}

// --- Encryption Middleware Function ---
export default function encryptionMiddleware(req: any, res: any, next: any) {
  try {

    // Process request body or query data if it exists.
    const data = req.body || req.query;
    if (
      data &&
      (
        (typeof data === 'object' && Object.keys(data).length > 0) ||
        (typeof data === 'string' && data.trim() !== '')
      )
    ) {
      // If the data is a JWT token, skip encryption.
      if (typeof data === 'string' && isJWTToken(data)) {
      } else {
        const encryptedData = rsa.encrypt(data, 'utf8', 'base64', encryptionOptions);
        req.body = encryptedData;
      }
    }

    // Override res.send to encrypt outgoing responses.
    const originalSend = res.send.bind(res);
    res.send = function (data: any) {
      // If the response is a JWT token (string) then do not encrypt.
      if (typeof data === 'string' && isJWTToken(data)) {
        return originalSend(data);
      }

      const encryptedData = publicRsa.encrypt(JSON.stringify(data), 'utf8', 'base64', encryptionOptions);
      res.setHeader('Content-Type', 'application/base64');
      return originalSend(encryptedData);
    };
    next();
  } catch (error) {
    next(error);
  }
}
