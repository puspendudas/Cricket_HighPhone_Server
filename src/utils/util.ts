/**
 * @method isEmpty
 * @param {String | Number | Object} value
 * @returns {Boolean} true & false
 * @description this value is Empty Check
 */
import { GAME_OFF } from '@/config';

export const isEmpty = (value: string | number | object): boolean => {
  if (value === null) {
    return true;
  } else if (typeof value !== 'number' && value === '') {
    return true;
  } else if (typeof value === 'undefined' || value === undefined) {
    return true;
  } else if (value !== null && typeof value === 'object' && !Object.keys(value).length) {
    return true;
  } else {
    return false;
  }
};

export const encrypt = (text, shift) => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode >= 32 && charCode <= 126) { // Range of printable ASCII characters
      result += String.fromCharCode(((charCode - 32 + shift) % 95) + 32);
    } else {
      result += text.charAt(i); // Characters outside the range remain unchanged
    }
  }
  return result;
}

// Decryption function
export const decrypt = (text, shift) => {
  return encrypt(text, (95 - shift) % 95); // Decryption is just encryption with the inverse shift
}

export const comparePassword = (password, enPassword, shift) => {
  // if (type === "super_admin") {
  //   const ciphertext1 = password;
  //   const ciphertext2 = enPassword
  //   return ciphertext1 === ciphertext2;
  // }
  const ciphertext1 = encrypt(password, shift);
  const ciphertext2 = enPassword;
  return ciphertext1 === ciphertext2;
}

export const checkMarketTime = (market_limit: any) => {
  // Helper function to adjust time to IST (UTC + 5:30)
  const toIST = (date: Date) => {
    const utcOffset = date.getTime() + (date.getTimezoneOffset() * 60000); // Convert to UTC
    const istOffset = 5.5 * 60 * 60000; // IST is UTC + 5:30
    return new Date(utcOffset + istOffset); // Convert to IST
  };
  const today = toIST(new Date()); // Get current time in IST
  const game_off = Number(GAME_OFF);

  let openTimeParts;
  // Parse open time and close time
  const closeTimeParts = market_limit.close_time.split(':');
  if (market_limit.tag !== "galidisawar") {
    openTimeParts = market_limit.open_time.split(':');
  }

  let openTime;
  if (market_limit.tag !== "galidisawar") {
    openTime = new Date();
    openTime.setHours(parseInt(openTimeParts[0], 10));
    openTime.setMinutes(parseInt(openTimeParts[1], 10));
  }

  const closeTime = new Date();
  closeTime.setHours(parseInt(closeTimeParts[0], 10));
  closeTime.setMinutes(parseInt(closeTimeParts[1], 10));

  // Subtract game_off minutes from openTime and closeTime
  const openTimeMinus20 = openTime && !isNaN(game_off) ? new Date(openTime.getTime() - game_off * 60000) : openTime;
  const closeTimeMinus20 = !isNaN(game_off) ? new Date(closeTime.getTime() - game_off * 60000) : closeTime;

  const openToUse = openTimeMinus20 || openTime;
  const closeToUse = closeTimeMinus20 || closeTime;
  // Compare current time with open time and close time
  const marketTags = {
    main: {
      open: {
        "single-digit": true, "double-digit": true, "single-panna": true, "double-panna": true, "triple-panna": true,
        "even-odd-digit": true, "full-sangum": true, "half-sangum": true, "sp-dp-tp": true, "sp-mortor": true,
        "dp-mortor": true, "double-even-odd": true, "jodi-bulk": true, "single-panna-bulk": true, "double-panna-bulk": true
      },
      close: {
        "single-digit": true, "double-digit": false, "single-panna": true, "double-panna": true, "triple-panna": true,
        "even-odd-digit": true, "full-sangum": false, "half-sangum": false, "sp-dp-tp": true, "sp-mortor": true,
        "dp-mortor": true, "double-even-odd": false, "jodi-bulk": false, "single-panna-bulk": true, "double-panna-bulk": true
      },
      closed: {
        "single-digit": false, "double-digit": false, "single-panna": false, "double-panna": false, "triple-panna": false,
        "even-odd-digit": false, "full-sangum": false, "half-sangum": false, "sp-dp-tp": false, "sp-mortor": false,
        "dp-mortor": false, "double-even-odd": false, "jodi-bulk": false, "single-panna-bulk": false, "double-panna-bulk": false
      }
    },
    starline: {
      open: {
        "single-digit": true, "single-panna": true, "double-panna": true, "triple-panna": true, "even-odd-digit": true
      },
      close: {
        "single-digit": false, "single-panna": false, "double-panna": false, "triple-panna": false, "even-odd-digit": false
      },
      closed: {
        "single-digit": false, "single-panna": false, "double-panna": false, "triple-panna": false, "even-odd-digit": false
      }
    },
    galidisawar: {
      close: {
        "left-digit": true, "right-digit": true, "jodi-digit": true
      },
      closed: {
        "left-digit": false, "right-digit": false, "jodi-digit": false
      }
    }
  };

  let data: any, message: any;

  if (market_limit.tag in marketTags) {
    if (today < openToUse) {
      data = marketTags[market_limit.tag].open;
      message = 'Market is currently open running.';
    } else if (today < closeToUse) {
      data = marketTags[market_limit.tag].close;
      message = 'Market is currently close running.';
    } else {
      data = marketTags[market_limit.tag].closed;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      message = 'Market is currently closed.';
    }
    // console.log(message);
  }
  return data
}

export const convertFromTo = (utcDate: any) => {
  const date = new Date(utcDate);
  date.setDate(date.getDate() - 1);
  const result_date_next = date.toISOString().split('T')[0];
  const from: any = `${result_date_next}T18:30:00.000Z`;
  const to: any = `${utcDate}T18:29:59.999Z`;

  return { from, to };
}

