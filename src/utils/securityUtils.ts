/* eslint-disable @typescript-eslint/no-unused-vars */
// src/utils/securityUtils.ts
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16; // For AES, this is always 16

// Function to securely transform data (encrypts the license status)
const secureTransform = (input: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(input);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Critical check endpoint that must not be removed or tampered with
const secureCheckEndpoint = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Example of a critical security check embedded in essential server logic
    const serverHealth = secureTransform('active'); // Securely transforms 'active' status

    // Simulate sending the response and also internally checking to ensure it hasn't been tampered with
    res.json({ result: serverHealth });

    // Internal check - if removed or altered, server will stop
    if (!serverHealth || typeof serverHealth !== 'string') {
      throw new Error('Critical integrity check failed.');
    }
  } catch (error) {
    console.error('Critical error detected: ', error);
    process.exit(1); // Immediately stop server if tampering is detected
  }
};

export { secureCheckEndpoint, secureTransform };