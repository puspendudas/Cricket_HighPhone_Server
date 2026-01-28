import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { RequestHandler } from 'express';
import { HttpException } from '@exceptions/HttpException';

const validationMiddleware = (
  type: any,
  value: string | 'body' | 'query' | 'params' = 'body',
  skipMissingProperties = false,
  whitelist = true,
  forbidNonWhitelisted = false,
): RequestHandler => {
  return (req, res, next) => {
    let requestBody = req[value];
    const isArray = Array.isArray(requestBody);
    if (!isArray) {
      requestBody = [requestBody];
    }
    requestBody = requestBody.map(item => {
      if (typeof item === 'object' && item !== null) {
        for (const key in item) {
          if (item.hasOwnProperty(key)) {
            if (key === 'amount' || key === 'prev_balance' || key === 'current_balance') {
              item[key] = Number(item[key]);
            }
          }
        }
      }
      return item;
    });
    const objects = plainToInstance(type, requestBody) as object[];
    Promise.all(objects.map(item => validate(item, { skipMissingProperties, whitelist, forbidNonWhitelisted })))
      .then((results: ValidationError[][]) => {
        const errors = results.flat();
        if (errors.length > 0) {
          // console.log('Validation errors:', errors);
          const message = errors.map((error: ValidationError) => Object.values(error.constraints ?? {})).join(', ');
          next(new HttpException(400, message));
        } else {
          req[value] = isArray ? objects : objects[0];
          next();
        }
      })
      .catch(err => {
        console.error('Validation exception:', err);
        next(new HttpException(500, 'Internal Server Error'));
      });
  };
};

export default validationMiddleware;
