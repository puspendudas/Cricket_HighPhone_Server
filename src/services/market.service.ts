import { HttpException } from '@exceptions/HttpException';
import { checkMarketTime, convertFromTo, isEmpty } from '@utils/util';
import MarketModel from '@/models/market.model';
import { CreateMarketDto, DeclareResultDto, DeclareResultGaliDto, DeleteResultDto, GetMarketDto, GetResultMarketDto, GetResultsDto, TodayDataDto, ToggleMarketDto, TotalDataDto, UpdateMarketDto, UpdateMarketOffDto } from '@/dtos/market.dto';
import { GetAllMarketQuery, Market, MarketRespond } from '@/interfaces/market.interface';
import SettingModel from '@/models/setting.model';
import ResultModel from '@/models/result.model';
import BetModel from '@/models/bet.model';
import TransactionModel from '@/models/transaction.model';
import UserModel from '@/models/user.model';
import firebase from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import ResultCheckModel from '@/models/resultcheck.model';
import { upperCase } from 'lodash';
import MARKETSDATA from '../assets/market.data.json';
import AdminModel from '@/models/admin.model';

class MarketService {
  public market = MarketModel;
  public setting = SettingModel;
  public result = ResultModel;
  public resultCheck = ResultCheckModel;
  public bet = BetModel;
  public transaction = TransactionModel;
  public user = UserModel;
  public admin = AdminModel;

  public async create(marketData: CreateMarketDto): Promise<Market> {
    if (isEmpty(marketData)) throw new HttpException(400, 'marketData is empty');

    const findMarket: Market = await this.market.findOne({ name: marketData.name });

    if (findMarket) throw new HttpException(409, `This market ${marketData.name} already exists`);

    const createMarketData: Market = await this.market.create({ ...marketData });

    return createMarketData;
  }

  public async update(marketData: UpdateMarketDto): Promise<Market> {
    if (isEmpty(marketData)) throw new HttpException(400, 'marketData is empty');

    const updateMarketData: Market = await this.market.findByIdAndUpdate(marketData.id, { ...marketData });

    return updateMarketData;
  }

  public async toggleMarketOff(marketOffData: UpdateMarketOffDto): Promise<Market> {
    if (isEmpty(marketOffData)) throw new HttpException(400, 'market Data is empty');
    const foundMarket = await this.market.findById(marketOffData.id);
    if (!foundMarket) { throw new HttpException(400, "No market found for the id"); }
    const toggleMap = {
      "monday": "monday",
      "tuesday": "tuesday",
      "wednesday": "wednesday",
      "thursday": "thursday",
      "friday": "friday",
      "saturday": "saturday",
      "sunday": "sunday",
    };

    const toggle = marketOffData.toggle;
    if (toggleMap.hasOwnProperty(toggle)) {
      foundMarket.market_off_day[toggleMap[toggle]] = !foundMarket.market_off_day[toggleMap[toggle]];
    }
    await foundMarket.save();
    return foundMarket
  }

  public async getAll(marketData: GetAllMarketQuery): Promise<{ total: number; markets: Market[] }> {
    // Clone the marketData object
    const query: GetAllMarketQuery = { ...marketData };

    // Set default values for skip and count, if not provided
    const skip: number = query.skip ? Number(query.skip) : 0;
    const count: number = query.count ? Number(query.count) : undefined;

    // Clean up undefined fields from the query
    for (const key in query) {
      if (query[key] === undefined) {
        delete query[key];
      }
    }

    // Fetch the total number of markets that match the query
    const total = await this.market.countDocuments(query);

    // Set the limit for pagination
    const limit = count !== undefined ? Number(count) : total;

    // Perform the query with skip, limit, and sorting
    const markets: Market[] = await this.market
      .find(query)
      .skip(skip * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    return { total, markets };
  }

  public async getAllApp(userId: string, marketData: GetAllMarketQuery): Promise<{ total: number; markets: Market[] }> {
    const userList = await this.user.findById(userId).select('-mpin -__v')
    // Clone the marketData object
    const query: GetAllMarketQuery = { ...marketData };

    // Set default values for skip and count, if not provided
    const skip: number = query.skip ? Number(query.skip) : 0;
    const count: number = query.count ? Number(query.count) : undefined;

    // Clean up undefined fields from the query
    for (const key in query) {
      if (query[key] === undefined) {
        delete query[key];
      }
    }

    // Fetch the total number of markets that match the query
    let total = await this.market.countDocuments(query);

    // Set the limit for pagination
    const limit = count !== undefined ? Number(count) : total;

    // Perform the query with skip, limit, and sorting
    let markets: any = await this.market
      .find(query)
      .skip(skip * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
    if (!userList.status) {
      total = MARKETSDATA.length
      markets = MARKETSDATA
    }

    return { total, markets };
  }

  public async getAllMarketResults(marketData: GetResultMarketDto): Promise<any> {
    const { name, status, tag, query_date } = marketData;

    const { from, to } = convertFromTo(query_date);
    const resultsQuery = { tag, from, to };
    const marketQuery = {
      ...(tag && { tag }),
      ...(name && { name: { $regex: new RegExp(name, 'i') } }),
      ...(status && { status })
    };

    // Combined fetching results and market lists with necessary projections and sorting
    const [resultsList, marketList] = await Promise.all([
      this.result.find(resultsQuery)
        .populate({ path: 'market_id' })
        .sort({ from: -1 }),
      this.market.find(marketQuery)
        .sort({ createdAt: -1 })
    ]);

    const marketsWithCloseResults = new Set();
    resultsList.forEach(result => {
      let shouldAddMarket: any = false;
      if (tag === "galidisawar" || tag === "starline") {
        shouldAddMarket = !!result.open_result;
      } else if (tag === "main") {
        // Check specific conditions for "main"
        shouldAddMarket = (!!result.open_result && !!result.close_result);
      } else {
        shouldAddMarket = !!result.close_result;
      }

      if (shouldAddMarket) {
        marketsWithCloseResults.add(result.market_name);
      }
    });

    // Filtering markets based on the results
    const filteredMarketList = marketList.filter(market => !marketsWithCloseResults.has(market.name));

    return { total: filteredMarketList.length, data: filteredMarketList };
  }

  public async getMarket(marketData: GetMarketDto): Promise<{ data: string }> {
    if (isEmpty(marketData)) throw new HttpException(400, 'marketData is empty');
    const { from, to } = convertFromTo(marketData.query_date);
    const foundResults = await this.result.find({ market_id: marketData.market_id, from, to }).sort({ from: -1 });
    let data: string;

    if (!foundResults || foundResults.length === 0 || !(foundResults[0].open_result)) {
      data = 'open';
    } else if (!(foundResults[0].close_result) && !(foundResults[0].tag === "starline") && !(foundResults[0].tag === "galidisawar")) {
      data = 'close';
    } else {
      data = '-';
    }
    return { data };
  }

  public async toggleMarket(marketToggleData: ToggleMarketDto): Promise<MarketRespond> {
    if (isEmpty(marketToggleData)) throw new HttpException(400, 'maket Data is empty');
    const foundMarket = await this.market.findById(marketToggleData.id);
    if (!foundMarket) {
      throw new HttpException(400, "No market found for the id");
    }
    foundMarket.status = !foundMarket.status;
    await foundMarket.save();
    return foundMarket
  }

  public async marketGames(marketGameData: ToggleMarketDto): Promise<MarketRespond> {
    if (isEmpty(marketGameData)) throw new HttpException(400, 'maket Data is empty');
    const foundMarket = await this.market.findById(marketGameData.id);
    if (!foundMarket) {
      throw new HttpException(400, "No market found for the id");
    }
    const market = await checkMarketTime(foundMarket);
    return market
  }

  public async declareResult(resultData: DeclareResultDto): Promise<void> {
    if (!resultData.market_id) throw new HttpException(400, 'Market ID is required');
    const { market_id, session, result_date, bet_status, tag, digit, panna } = resultData;
    const { from, to } = convertFromTo(result_date)
    const result = [panna, digit]

    if (!market_id) throw new HttpException(400, 'Need market ID');

    const foundMarket = await this.market.findById(market_id);
    if (!foundMarket) throw new HttpException(404, 'No market found for the given ID');
    if (!foundMarket.market_status) throw new HttpException(400, 'Today market is not open');

    const defaultSettings = await this.setting.findOne({ name: 'global' });
    if (!defaultSettings) throw new HttpException(404, 'Global settings not found');

    const rates = tag === 'main' ? defaultSettings?.rates?.main : defaultSettings?.rates?.starline;
    if (!rates) throw new HttpException(400, `Set rates for ${tag} games`);

    const givenDate = new Date(to).setUTCHours(0, 0, 0, 0);
    const currentDate = new Date().setUTCHours(0, 0, 0, 0);

    if (givenDate >= currentDate) {
      const marketKeyPrefix = session === 'open' ? 'open' : session === 'close' ? 'close' : null;
      if (marketKeyPrefix) {
        foundMarket[`${marketKeyPrefix}_digit`] = digit;
        foundMarket[`${marketKeyPrefix}_panna`] = panna;
      }
    }

    const foundResult = await this.result.find({ market_id, tag, from, to }).sort({ from: -1 });
    if (foundResult.length === 0 && session === 'close') {
      throw new HttpException(400, 'First declare open result');
    }

    let open_digit: any, close_digit: any, open_panna: any, close_panna: any;
    if (session === 'open') {
      ({ digit: open_digit, panna: open_panna } = { digit, panna });
    } else {
      ({ digit: close_digit, panna: close_panna } = { digit, panna });
    }

    let updateResult: any;
    if (foundResult.length === 0) {
      updateResult = new this.result({ market_id, from, to, tag, market_name: foundMarket.name });
      if (session === 'open') {
        updateResult.open_declare = new Date();
        updateResult.open_result = `${panna} - ${digit}`;
      } else if (session === 'close') {
        updateResult.close_declare = new Date();
        updateResult.close_result = `${panna} - ${digit}`;
      }
      await updateResult.save();
    } else {
      const matchedResult = await this.result.findById(foundResult[0]._id);
      if ((matchedResult.open_result && matchedResult.close_result) ||
        (matchedResult.open_result && session === 'open') ||
        (matchedResult.close_result && session === 'close')) {
        throw new HttpException(400, "Can't re-declare result");
      }

      if (session === 'open') {
        matchedResult.open_declare = new Date();
        matchedResult.open_result = `${panna} - ${digit}`;
      } else if (session === 'close') {
        matchedResult.close_declare = new Date();
        matchedResult.close_result = `${panna} - ${digit}`;
      }
      await matchedResult.save();

      if (matchedResult.open_result) {
        [open_panna, , open_digit] = matchedResult.open_result.split(' ');
      }
      if (matchedResult.close_result) {
        [close_panna, , close_digit] = matchedResult.close_result.split(' ');
      }
    }

    await foundMarket.save();

    const queryObject = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running',
      session: 'open'
    };
    const queryObjectClose = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running'
    };

    const updatedBets = session === 'open' ? await this.bet.find(queryObject).populate('user_id') : await this.bet.find(queryObjectClose).populate('user_id');

    if (defaultSettings.auto_notification) {
      const forResult = session === 'open' ? `${open_panna} - ${open_digit}` : `${open_panna} - ${open_digit}${close_digit} - ${close_panna}`;

      let firebaseMessage;
      let firebaseTitle;
      if (tag === "starline") {
        firebaseTitle = `STARLINE: ${foundMarket.name}`
        firebaseMessage = `Declare Result: ${forResult}`;
      } else if (tag === "main") {
        firebaseTitle = `Market name: ${foundMarket.name}`;
        firebaseMessage = session === "open" ? `Open Declare Result: ${forResult}` :
          session === "close" ? `Close Declare Result: ${forResult}` : `Declare Result: ${forResult}`;
      }
      const notificationKeyMap: { [key: string]: string } = {
        main: "main_notification",
        starline: "starline_notification",
      };

      const notificationKey = notificationKeyMap[tag];
      const queryUser = { status: true, verified: true, [notificationKey]: true };
      const userList = await this.user.find(queryUser);

      const sendNotifications = async () => {
        const promises = userList.map(async (user) => {
          if (user.fcm !== '-') {
            const message = {
              notification: {
                title: firebaseTitle,
                body: firebaseMessage
              },
              token: user.fcm
            };

            try {
              await firebase.messaging().send(message);
            } catch (error) {
              console.error('Error sending message:', error);
            }
          }
        });

        await Promise.all(promises);
      };
      await sendNotifications();
    }
    // console.log("open_digit", open_digit, "close_digit", close_digit, "open_panna", open_panna, "close_panna", close_panna)

    for (const betItem of updatedBets) {
      betItem.result = result;
      if (bet_status !== 'cancelled') {
        // const transactionData = {
        //   user_id: betItem.user_id,
        //   type: 'bet',
        //   note: 'bet closed',
        //   status: 'completed',
        //   bet_id: betItem._id,
        //   market_id
        // };

        const foundUser = await this.user.findById(betItem.user_id);
        if (!foundUser) continue;

        const updateTransaction = async (win: boolean, amountChange: number) => {
          // console.log('wallet', foundUser.wallet);
          // const newTransaction = new this.transaction({
          //   ...transactionData,
          //   prev_balance: foundUser.wallet,
          //   current_balance: foundUser.wallet,
          //   amount: amountChange,
          //   transfer_type: win ? 'win' : 'lose'
          // });

          if (win) {
            foundUser.wallet += amountChange;
            // newTransaction.current_balance = foundUser.wallet;
          }

          await foundUser.save();
          // const savedTransaction = await newTransaction.save();
          // betItem.transaction = savedTransaction._id;
          betItem.bet_amount = betItem.points;
          betItem.winning_amount = amountChange;
          betItem.status = bet_status;
          betItem.win = win ? 'true' : 'false';
          await betItem.save();
        };

        const calculateWinnings = (rate1: number, rate2: number) => Math.floor((betItem.points / rate1) * rate2);

        const gameModes = {
          'single-digit': {
            rate1: rates.single_digit_1,
            rate2: rates.single_digit_2,
            condition: session === 'open'
              ? Number(open_digit) === Number(betItem.open_digit)
              : Number(close_digit) === Number(betItem.close_digit)
          },
          'double-digit': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'single-panna': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'double-panna': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'full-sangum': {
            rate1: rates.full_sangum_1,
            rate2: rates.full_sangum_2,
            condition: Number(open_panna) === Number(betItem.open_panna) && Number(close_panna) === Number(betItem.close_panna)
          },
          'half-sangum': {
            rate1: rates.half_sangum_1,
            rate2: rates.half_sangum_2,
            condition: betItem.close_digit === '-'
              ? Number(open_digit) === Number(betItem.open_digit) && Number(close_panna) === Number(betItem.close_panna)
              : Number(close_digit) === Number(betItem.close_digit) && Number(open_panna) === Number(betItem.open_panna)
          },
          'triple-panna': {
            rate1: rates.tripple_panna_1,
            rate2: rates.tripple_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'sp-mortor': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'dp-mortor': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'even-odd-digit': {
            rate1: rates.even_odd_digit_1,
            rate2: rates.even_odd_digit_2,
            condition: session === 'open'
              ? Number(open_digit) === Number(betItem.open_digit)
              : Number(close_digit) === Number(betItem.close_digit)
          },
          'double-even-odd': {
            rate1: rates.double_even_odd_1,
            rate2: rates.double_even_odd_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'sp-dp-tp': {
            rate1: null,
            rate2: null,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna),
            subRates: {
              sp: { rate1: rates.single_panna_1, rate2: rates.single_panna_2 },
              dp: { rate1: rates.double_panna_1, rate2: rates.double_panna_2 },
              tp: { rate1: rates.tripple_panna_1, rate2: rates.tripple_panna_2 }
            }
          },
          'jodi-bulk': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'single-panna-bulk': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'double-panna-bulk': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          }
        };

        const gameMode = gameModes[betItem.game_mode];
        if (gameMode) {
          let winningAmount = 0;
          let win = false;
          if (betItem.game_mode === 'sp-dp-tp') {
            const subModeRates = gameMode.subRates[betItem.sub_mode];
            if (subModeRates && gameMode.condition) {
              winningAmount = calculateWinnings(subModeRates.rate1, subModeRates.rate2);
              win = true;
            }
          } else if (gameMode.condition) {
            winningAmount = calculateWinnings(gameMode.rate1, gameMode.rate2);
            win = true;
          }
          await updateTransaction(win, winningAmount);
        }
      }
    }
  }

  public async declareResultGali(resultData: DeclareResultGaliDto): Promise<void> {
    if (!resultData.market_id) throw new HttpException(400, 'Market ID is required');
    const { market_id, result_date, bet_status, tag, left_digit, right_digit } = resultData;
    const { from, to } = convertFromTo(result_date)
    const result = [left_digit, right_digit]

    if (!market_id) throw new HttpException(400, 'Need market ID');

    const foundMarket = await this.market.findById(market_id);
    if (!foundMarket) throw new HttpException(404, 'No market found for the given ID');
    if (!foundMarket.market_status) throw new HttpException(400, 'Today market is not open');

    const defaultSettings = await this.setting.findOne({ name: 'global' });
    if (!defaultSettings) throw new HttpException(404, 'Global settings not found');

    const rates = defaultSettings?.rates?.galidisawar;
    if (!rates) throw new HttpException(400, `Set rates for ${tag} games`);

    const givenDate = new Date(to).setUTCHours(0, 0, 0, 0);
    const currentDate = new Date().setUTCHours(0, 0, 0, 0);

    if (givenDate >= currentDate) {
      foundMarket[`open_digit`] = left_digit;
      foundMarket[`close_digit`] = right_digit;
    }

    const foundResult = await this.result.find({ market_id, tag, from, to }).sort({ from: -1 });

    const open_digit = left_digit
    const close_digit = right_digit

    let updateResult: any;
    if (foundResult.length === 0) {
      updateResult = new this.result({ market_id, from, to, tag, market_name: foundMarket.name });
      updateResult.open_declare = new Date();
      updateResult.open_result = `${left_digit} - ${right_digit}`;
      await updateResult.save();
    } else {
      const matchedResult = await this.result.findById(foundResult[0]._id);
      if (matchedResult.open_result) {
        throw new HttpException(400, "Can't re-declare result");
      }

      matchedResult.open_declare = new Date();
      matchedResult.open_result = `${left_digit} - ${right_digit}`;
      await matchedResult.save();
    }

    await foundMarket.save();

    const queryObject = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running',
      tag: tag
    };

    const updatedBets = await this.bet.find(queryObject).populate('user_id')

    if (defaultSettings.auto_notification) {
      const queryUser = { status: true, verified: true, galidisawar_notification: true };
      const userList = await this.user.find(queryUser);

      const sendNotifications = async () => {
        const promises = userList.map(async (user) => {
          if (user.fcm !== '-') {
            const message = {
              notification: {
                title: `Market name: ${foundMarket.name}`,
                body: `Declare Result: ${left_digit}${right_digit}`
              },
              token: user.fcm
            };
            try {
              await firebase.messaging().send(message);
            } catch (error) {
              console.error('Error sending message:', error);
            }
          }
        });

        await Promise.all(promises);
      };

      await sendNotifications();
    }

    for (const betItem of updatedBets) {
      betItem.result = result;
      if (bet_status !== 'cancelled') {
        // const transactionData = {
        //   user_id: betItem.user_id,
        //   type: 'bet',
        //   note: 'bet closed',
        //   status: 'completed',
        //   bet_id: betItem._id,
        //   market_id
        // };

        const foundUser = await this.user.findById(betItem.user_id);
        if (!foundUser) continue;

        const updateTransaction = async (win: boolean, amountChange: number) => {
          // const newTransaction = new this.transaction({
          //   ...transactionData,
          //   prev_balance: foundUser.wallet,
          //   current_balance: foundUser.wallet,
          //   amount: amountChange,
          //   transfer_type: win ? 'win' : 'lose'
          // });

          if (win) {
            foundUser.wallet += amountChange;
            // newTransaction.current_balance = foundUser.wallet;
          }

          await foundUser.save();
          // const savedTransaction = await newTransaction.save();
          // betItem.transaction = savedTransaction._id;
          betItem.bet_amount = betItem.points;
          betItem.winning_amount = amountChange;
          betItem.status = bet_status;
          betItem.win = win ? 'true' : 'false';
          await betItem.save();
        };

        const calculateWinnings = (rate1: number, rate2: number) => {
          return Math.floor((betItem.points / rate1) * rate2);
        };

        type GameModeType = {
          rate1: number;
          rate2: number;
          condition: boolean;
        };

        const gameModes: Record<string, GameModeType> = {
          'left-digit': {
            rate1: rates.left_digit_1,
            rate2: rates.left_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit)
          },
          'jodi-digit': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'right-digit': {
            rate1: rates.right_digit_1,
            rate2: rates.right_digit_2,
            condition: Number(close_digit) === Number(betItem.close_digit)
          }
        };

        const gameMode = gameModes[betItem.game_mode];
        if (gameMode) {
          if (gameMode.condition) {
            const winningAmount = calculateWinnings(gameMode.rate1, gameMode.rate2);
            await updateTransaction(true, winningAmount);
          } else {
            await updateTransaction(false, 0);
          }
        }
      }
    }
  }

  public async winnersView(resultData: DeclareResultDto): Promise<{ data: any, total_bet_amount: number, total_winning_amount: number }> {
    const { market_id, session, result_date, bet_status, tag, digit, panna } = resultData;
    if (!market_id) throw new HttpException(400, 'Market ID is required');

    const { from, to } = convertFromTo(result_date)

    const foundMarket = await this.market.findById(market_id);
    if (!foundMarket || !foundMarket.market_status) throw new HttpException(404, 'Market not found or not open');

    const defaultSettings = await this.setting.findOne({ name: 'global' });
    const rates = tag === 'main' ? defaultSettings?.rates?.main : defaultSettings?.rates?.starline;
    if (!rates) throw new HttpException(400, `Set rates for ${tag} games`);

    const foundResult = await this.result.find({ market_id, tag, from, to }).sort({ from: -1 });
    if (foundResult.length === 0 && session === 'close') throw new HttpException(400, 'First declare open result');

    let open_digit: any, close_digit: any, open_panna: any, close_panna: any;
    if (session === 'open') {
      ({ digit: open_digit, panna: open_panna } = { digit, panna });
    } else {
      ({ digit: close_digit, panna: close_panna } = { digit, panna });
    }

    let updateResult: any;
    if (foundResult.length === 0) {
      updateResult = new this.result({ market_id, from, to, tag, market_name: foundMarket.name });

      updateResult[session === 'open' ? 'open_result' : 'close_result'] = `${panna} - ${digit}`;
    } else {
      const matchedResult = await this.result.findById(foundResult[0]._id);
      if (matchedResult.open_result && matchedResult.close_result) throw new HttpException(400, "Can't re-declare result");
      matchedResult[session === 'open' ? 'open_result' : 'close_result'] = `${panna} - ${digit}`;

      if (matchedResult.open_result) [open_panna, , open_digit] = matchedResult.open_result.split(' ');
      if (matchedResult.close_result) [close_panna, , close_digit] = matchedResult.close_result.split(' ');
    }

    const queryObject = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running',
      session: 'open'
    };
    const queryObjectClose = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running'
    };

    const updatedBets = session === 'open'
      ? await this.bet.find(queryObject).populate('user_id')
      : await this.bet.find(queryObjectClose).populate('user_id');

    const data = [];
    let total_bet_amount = 0;
    let total_winning_amount = 0;

    for (const betItem of updatedBets) {
      betItem.result = [panna, digit];
      if (bet_status !== 'cancelled') {
        const foundUser = await this.user.findById(betItem.user_id);
        if (!foundUser) continue;

        const updateTransaction = async (win, amountChange) => {
          if (win) foundUser.wallet += amountChange;
          total_winning_amount += amountChange;
          total_bet_amount += betItem.points;
          betItem.bet_amount = betItem.points;
          betItem.winning_amount = amountChange;
          betItem.status = bet_status;
          betItem.win = win ? 'true' : 'false';
          if (win) data.push(betItem);
        };

        const calculateWinnings = (rate1: number, rate2: number) => Math.floor((betItem.points / rate1) * rate2);

        const gameModes = {
          'single-digit': {
            rate1: rates.single_digit_1,
            rate2: rates.single_digit_2,
            condition: session === 'open'
              ? Number(open_digit) === Number(betItem.open_digit)
              : Number(close_digit) === Number(betItem.close_digit)
          },
          'double-digit': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'single-panna': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'double-panna': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'full-sangum': {
            rate1: rates.full_sangum_1,
            rate2: rates.full_sangum_2,
            condition: Number(open_panna) === Number(betItem.open_panna) && Number(close_panna) === Number(betItem.close_panna)
          },
          'half-sangum': {
            rate1: rates.half_sangum_1,
            rate2: rates.half_sangum_2,
            condition: betItem.close_digit === '-'
              ? Number(open_digit) === Number(betItem.open_digit) && Number(close_panna) === Number(betItem.close_panna)
              : Number(close_digit) === Number(betItem.close_digit) && Number(open_panna) === Number(betItem.open_panna)
          },
          'triple-panna': {
            rate1: rates.tripple_panna_1,
            rate2: rates.tripple_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'sp-mortor': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'dp-mortor': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'even-odd-digit': {
            rate1: rates.even_odd_digit_1,
            rate2: rates.even_odd_digit_2,
            condition: session === 'open'
              ? Number(open_digit) === Number(betItem.open_digit)
              : Number(close_digit) === Number(betItem.close_digit)
          },
          'double-even-odd': {
            rate1: rates.double_even_odd_1,
            rate2: rates.double_even_odd_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'sp-dp-tp': {
            rate1: null,
            rate2: null,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna),
            subRates: {
              sp: { rate1: rates.single_panna_1, rate2: rates.single_panna_2 },
              dp: { rate1: rates.double_panna_1, rate2: rates.double_panna_2 },
              tp: { rate1: rates.tripple_panna_1, rate2: rates.tripple_panna_2 }
            }
          },
          'jodi-bulk': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'single-panna-bulk': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'double-panna-bulk': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          }
        };

        const gameMode = gameModes[betItem.game_mode];
        if (gameMode) {
          let winningAmount = 0;
          let win = false;
          if (betItem.game_mode === 'sp-dp-tp') {
            const subModeRates = gameMode.subRates[betItem.sub_mode];
            if (subModeRates && gameMode.condition) {
              winningAmount = calculateWinnings(subModeRates.rate1, subModeRates.rate2);
              win = true;
            }
          } else if (gameMode.condition) {
            winningAmount = calculateWinnings(gameMode.rate1, gameMode.rate2);
            win = true;
          }
          await updateTransaction(win, winningAmount);
        }
      }
    }
    return { data, total_bet_amount, total_winning_amount };
  }

  public async winnersViewGali(resultData: DeclareResultGaliDto): Promise<{ data: any, total_bet_amount: number, total_winning_amount: number }> {
    if (!resultData.market_id) throw new HttpException(400, 'Market ID is required');
    const { market_id, result_date, bet_status, tag, left_digit, right_digit } = resultData;
    const { from, to } = convertFromTo(result_date)
    const result = [left_digit, right_digit]

    if (!market_id) throw new HttpException(400, 'Need market ID');

    const foundMarket = await this.market.findById(market_id);
    if (!foundMarket) throw new HttpException(404, 'No market found for the given ID');
    if (!foundMarket.market_status) throw new HttpException(400, 'Today market is not open');

    const defaultSettings = await this.setting.findOne({ name: 'global' });
    if (!defaultSettings) throw new HttpException(404, 'Global settings not found');

    const rates = defaultSettings?.rates?.galidisawar;
    if (!rates) throw new HttpException(400, `Set rates for ${tag} games`);

    const open_digit = left_digit
    const close_digit = right_digit

    const queryObject = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running',
      tag: tag
    };

    const updatedBets = await this.bet.find(queryObject).populate('user_id')

    const data: any = []
    let total_bet_amount = 0;
    let total_winning_amount = 0;

    for (const betItem of updatedBets) {
      betItem.result = result;
      if (bet_status !== 'cancelled') {

        const foundUser = await this.user.findById(betItem.user_id);
        if (!foundUser) continue;

        const updateTransaction = async (win: boolean, amountChange: number) => {

          if (win) {
            foundUser.wallet += amountChange;
          }
          total_winning_amount += Number(amountChange);
          total_bet_amount += Number(betItem.points);
          betItem.bet_amount = betItem.points;
          betItem.winning_amount = amountChange;
          betItem.status = bet_status;
          betItem.win = win ? 'true' : 'false';
          win && data.push(betItem);
        };

        const calculateWinnings = (rate1: number, rate2: number) => {
          return Math.floor((betItem.points / rate1) * rate2);
        };

        type GameModeType = {
          rate1: number;
          rate2: number;
          condition: boolean;
        };

        const gameModes: Record<string, GameModeType> = {
          'left-digit': {
            rate1: rates.left_digit_1,
            rate2: rates.left_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit)
          },
          'jodi-digit': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'right-digit': {
            rate1: rates.right_digit_1,
            rate2: rates.right_digit_2,
            condition: Number(close_digit) === Number(betItem.close_digit)
          }
        };

        const gameMode = gameModes[betItem.game_mode];
        if (gameMode) {
          if (gameMode.condition) {
            const winningAmount = calculateWinnings(gameMode.rate1, gameMode.rate2);
            await updateTransaction(true, winningAmount);
          } else {
            await updateTransaction(false, 0);
          }
        }
      }
    }
    return { data, total_bet_amount, total_winning_amount };
  }

  public async getResults(queryParams: GetResultsDto): Promise<{ total: number; data: any[] }> {
    // console.log(queryParams);

    const { market_id, tag, skip = 0, market_name, from, count } = queryParams;

    const date = new Date(from ?? Date.now());
    date.setDate(date.getDate() - 1);
    const resultDateNext = date.toISOString().split('T')[0];
    const current_date = `${resultDateNext}T18:30:00.000Z`;

    const query: any = {};
    if (tag !== undefined) query.tag = String(tag);
    if (market_id !== undefined) query.market_id = String(market_id);
    query.from = String(current_date);
    if (market_name !== undefined) query.market_name = { $regex: String(market_name), $options: 'i' };

    const total = await this.result.countDocuments(query);
    const limit = count !== undefined ? Number(count) : total;

    const result_list = await this.result
      .find(query)
      .populate({
        path: 'market_id',
        select: '-market_off_day'
      })
      .sort({ updatedAt: -1 })
      .skip(Number(skip) * limit)
      .limit(limit);

    return { total, data: result_list };
  }

  public async getResultsApp(queryParams: GetResultsDto): Promise<{ total: number; data: any[] }> {
    const { market_id, tag, market_name, from } = queryParams;
    const query: any = {};
    if (from !== undefined) {
      const date = new Date(from ?? Date.now());
      date.setDate(date.getDate() - 1);
      const resultDateNext = date.toISOString().split('T')[0];
      const current_date = `${resultDateNext}T18:30:00.000Z`;
      query.from = String(current_date);
    }
    if (tag !== undefined) query.tag = String(tag);
    if (market_id !== undefined) query.market_id = String(market_id);
    if (market_name !== undefined) query.market_name = { $regex: String(market_name), $options: 'i' };

    const total = await this.result.countDocuments(query);

    const result_list = await this.result
      .find(query)
      .sort({ from: -1 })

    const formatted_data = result_list.map(item => {
      const { _id, market_id, market_name, tag, from, to, createdAt, updatedAt, __v } = item;
      let open_digit = '-';
      let open_panna = '-';
      let close_digit = '-';
      let close_panna = '-';
      if (tag === "galidisawar") {
        if (item.open_result) {
          const open_result = item.open_result.split(' - ');
          open_digit = open_result[0];
          close_digit = open_result[1];
        }
      } else {
        if (item.open_result) {
          const open_result = item.open_result.split(' - ');
          open_panna = open_result[0];
          open_digit = open_result[1];
        }
        if (item.close_result) {
          const close_result = item.close_result.split(' - ');
          close_panna = close_result[0];
          close_digit = close_result[1];
        }
      }

      return {
        _id,
        market_id,
        market_name,
        tag,
        from,
        to,
        open_digit,
        open_panna,
        close_digit,
        close_panna,
        createdAt,
        updatedAt,
        __v
      };
    });

    return { total, data: formatted_data };
  }

  public async getResultsWeb(queryParams: GetResultsDto): Promise<{ total: number; data: any[] }> {
    const { market_id, tag, market_name, from } = queryParams;
    const query: any = {};
    if (from !== undefined) {
      const date = new Date(from ?? Date.now());
      date.setDate(date.getDate() - 1);
      const resultDateNext = date.toISOString().split('T')[0];
      const current_date = `${resultDateNext}T18:30:00.000Z`;
      query.from = String(current_date);
    }
    if (tag !== undefined) query.tag = String(tag);
    if (market_id !== undefined) query.market_id = String(market_id);
    if (market_name !== undefined) query.market_name = { $regex: String(market_name), $options: 'i' };

    const total = await this.result.countDocuments(query);

    const result_list = await this.result
      .find(query)
      .populate("market_id", "-market_off_day")
      .sort({ from: -1 })

    const formatted_data = result_list.map(item => {
      const { _id, market_id, market_name, tag, from, to, createdAt, updatedAt, __v } = item;
      let open_digit = '-';
      let open_panna = '-';
      let close_digit = '-';
      let close_panna = '-';
      if (tag === "galidisawar") {
        if (item.open_result) {
          const open_result = item.open_result.split(' - ');
          open_digit = open_result[0];
          close_digit = open_result[1];
        }
      } else {
        if (item.open_result) {
          const open_result = item.open_result.split(' - ');
          open_panna = open_result[0];
          open_digit = open_result[1];
        }
        if (item.close_result) {
          const close_result = item.close_result.split(' - ');
          close_panna = close_result[0];
          close_digit = close_result[1];
        }
      }

      return {
        _id,
        market_name,
        tag,
        from,
        to,
        open_digit,
        open_panna,
        close_digit,
        close_panna,
        createdAt,
        updatedAt,
        __v,
        market_id: {
          market_id: market_id._id,
          name: market_id.name,
          name_hindi: market_id.name_hindi,
          open_time: market_id.open_time,
          close_time: market_id.close_time,
          status: market_id.status,
          tag: market_id.tag,
          market_status: market_id.market_status,
          createdAt: market_id.createdAt,
          updatedAt: market_id.updatedAt,
          __v: market_id.__v
        }
      };
    });

    return { total, data: formatted_data };
  }

  public async deleteResultById(resultData: string): Promise<{ status: string; message: string }> {
    if (isEmpty(resultData)) throw new HttpException(400, 'marketData is empty');

    const foundResult = await this.result.findById({ _id: resultData });
    if (!foundResult) {
      throw new HttpException(404, 'Result not found.');
    }

    const { from, to, market_id } = foundResult;
    const marketRecord = await this.market.findById(market_id);

    if (!marketRecord) {
      throw new HttpException(404, 'Market not found.');
    }

    marketRecord.open_digit = "-";
    marketRecord.close_digit = "-";
    marketRecord.open_panna = "-";
    marketRecord.close_panna = "-";
    await marketRecord.save();

    const queryObject = {
      createdAt: {
        $gte: new Date(from).toISOString(),
        $lt: new Date(to).toISOString()
      },
      market_id: market_id,
      status: 'closed'
    };

    const updatedBets = await this.bet.find(queryObject).populate("user_id");

    for (const betItem of updatedBets) {
      const { status, user_id, transaction, win, winning_amount } = betItem;
      if (status === "closed") {
        const foundUser = await this.user.findById(user_id);
        if (!foundUser) {
          continue;
        }

        const currentBalance = foundUser.wallet;
        await this.transaction.findByIdAndUpdate(transaction, { status: "cancelled" });

        if (win === 'true') {
          foundUser.wallet = (currentBalance - winning_amount > 0) ? currentBalance - winning_amount : 0
        }

        betItem.status = 'running';
        betItem.win = "-";
        betItem.winning_amount = 0;
        await betItem.save();
        await foundUser.save();
      }
    }

    await this.result.findByIdAndDelete(resultData);
    return { status: 'success', message: "Operation successful." };
  }

  public async deleteResultByIdAndSession(resultData: DeleteResultDto): Promise<{ status: string; message: string }> {
    if (isEmpty(resultData)) throw new HttpException(400, 'marketData is empty');
    const { result_id, session } = resultData;

    const foundResult = await this.result.findById(result_id).populate('market_id');
    if (!foundResult) throw new HttpException(404, 'Result not found.');
    const marketRecord = foundResult.market_id;
    if (!marketRecord) throw new HttpException(404, 'Market not found.');

    const updateFields = session === 'open'
      ? { open_digit: '-', open_panna: '-' }
      : { close_digit: '-', close_panna: '-' };

    Object.assign(marketRecord, updateFields);
    await marketRecord.save();

    const queryObject = {
      createdAt: { $gte: new Date(foundResult.from), $lt: new Date(foundResult.to) },
      market_id: foundResult.market_id._id,
      status: 'closed'
    };

    const updatedBets = await this.bet.find(queryObject).populate('user_id');

    const betPromises = updatedBets.map(async (betItem) => {
      if (betItem.status === 'closed' && (betItem.session === session || this.isSpecialGameMode(betItem.game_mode))) {
        await this.processBetItem(betItem);
      }
    });

    // Remove only the specific fields in the found result
    const updateQuery = session === 'open'
      ? { $unset: { open_declare: "", open_result: "" } }
      : { $unset: { close_declare: "", close_result: "" } };

    const isValidToUpdate = session === 'open'
      ? foundResult.close_result !== undefined && foundResult.close_declare !== undefined
      : foundResult.open_result !== undefined && foundResult.open_declare !== undefined;

    if (isValidToUpdate) {
      await this.result.updateOne({ _id: result_id }, updateQuery);
    } else {
      await this.result.findByIdAndDelete(result_id);
    }

    await Promise.all(betPromises);

    return { status: 'success', message: 'Operation successful.' };
  }

  private async processBetItem(betItem: any) {
    const foundUser = await this.user.findById(betItem.user_id);
    if (!foundUser) return;

    const currentBalance = foundUser.wallet;

    await Promise.all([
      this.transaction.findByIdAndUpdate(betItem.transaction, { status: 'cancelled' }),
      betItem.updateOne({ status: 'running', win: '-', winning_amount: 0 }),
      foundUser.updateOne({ wallet: betItem.win === 'true' ? Math.max(currentBalance - betItem.winning_amount, 0) : currentBalance })
    ]);
  }

  private isSpecialGameMode(game_mode: string): boolean {
    const specialGameModes = ['double-digit', 'full-sangum', 'half-sangum', 'double-even-odd'];
    return specialGameModes.includes(game_mode);
  }

  public async deleteMarket(marketId: string): Promise<void> {
    if (isEmpty(marketId)) throw new HttpException(400, 'marketData is empty');
    const foundItem = await this.market.findById(marketId);
    if (!foundItem) {
      throw new HttpException(404, 'Market not found');
    }
    await this.transaction.deleteMany({ market_id: marketId });
    await this.bet.deleteMany({ market_id: marketId });
    await this.result.deleteMany({ market_id: marketId });
    await this.market.findByIdAndDelete(marketId);
  }

  public async marketBetRevert(marketData: GetMarketDto): Promise<any> {
    this.validateMarketData(marketData);
    const { market_id, query_date } = marketData;
    const { from, to } = convertFromTo(query_date);
    try {
      const market = await this.findMarketById(market_id);
      const betData = await this.getBetsForMarketInDateRange(market._id, from, to);
      const betss = await this.getBetsForDateRange(from, to);
      const userDetails = await this.aggregateUserBets(betData, betss);
      await this.revertBetsAndAdjustWallets(userDetails);
      return this.buildSuccessResponse();
    } catch (error) {
      console.log(error);
      throw new HttpException(500, 'Failed to retrieve market bets.');
    }
  }

  private validateMarketData(marketData: GetMarketDto): void {
    if (!marketData) {
      throw new HttpException(400, 'marketData is empty.');
    }
  }

  private async findMarketById(marketId: string): Promise<any> {
    const market = await MarketModel.findById(marketId).exec();
    if (!market) {
      throw new HttpException(404, 'Market not found.');
    }
    return market;
  }

  private async getBetsForMarketInDateRange(marketId: string, from: Date, to: Date): Promise<any[]> {
    const query = { createdAt: { $gte: from, $lt: to }, market_id: marketId };
    return await BetModel.find(query).sort({ createdAt: 1 }).exec();
  }

  private async getBetsForDateRange(from: Date, to: Date): Promise<any[]> {
    const query = { createdAt: { $gte: from, $lt: to } };
    return await BetModel.find(query).sort({ createdAt: 1 }).exec();
  }

  private async aggregateUserBets(betData: any[], betss: any[]): Promise<any[]> {
    const uniqueUserIds = [...new Set(betData.map(bet => bet.user_id.toString()))];
    const users = await UserModel.find({ _id: { $in: uniqueUserIds } }).exec();
    return users.map(user => this.aggregateBetsForUser(user, betss));
  }

  private aggregateBetsForUser(user: any, allBets: any[]): any {
    const userBets = allBets.filter(bet => bet.user_id.toString() === user._id.toString());
    const firstBet = userBets.shift();
    const betsAfterFirstBet = userBets.map(({ _id, createdAt }) => ({ _id, createdAt }));
    return {
      user: { _id: user._id, wallet: user.wallet },
      firstBet,
      betsAfterFirstBet
    };
  }

  private async revertBetsAndAdjustWallets(userDetails: any[]): Promise<void> {
    const updatePromises = userDetails.flatMap(({ user, firstBet, betsAfterFirstBet }) =>
      this.prepareDatabaseUpdates(user, firstBet, betsAfterFirstBet)
    );
    await Promise.all(updatePromises);
  }

  private prepareDatabaseUpdates(userDetails: any, firstBet: any, betsAfterFirstBet: any[]): Promise<any>[] {
    const deleteBetsPromise = BetModel.deleteMany({ _id: { $in: betsAfterFirstBet.map(bet => bet._id) } }).exec();
    const updateUserWalletPromise = UserModel.findByIdAndUpdate(userDetails._id, { wallet: firstBet?.user_bal || userDetails.wallet }).exec();
    const deleteFirstBetPromise = firstBet ? BetModel.findByIdAndDelete(firstBet._id).exec() : Promise.resolve();

    return [deleteBetsPromise, updateUserWalletPromise, deleteFirstBetPromise];
  }

  private buildSuccessResponse(): any {
    return {
      status: 'success',
      message: 'Operation successful.',
    };
  }

  public async getTodayData(getBetData: TodayDataDto): Promise<any> {
    let createdAt: any = {};
    const date = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    const query_date = istDate.toISOString().split('T')[0];
    const { from, to } = convertFromTo(getBetData.query_date || query_date);

    createdAt = { $gte: String(from), $lt: String(to) };

    // Transaction queries
    const transactionQueries = [
      { transfer_type: "deposit", type: "transfer", status: "completed", createdAt },
      { transfer_type: "auto", status: "success", type: "mobile", createdAt },
      { transfer_type: "deposit", type: "mobile", status: "completed", createdAt },
      { transfer_type: "withdrawl", type: "transfer", status: "completed", createdAt },
      { transfer_type: "withdrawl", type: "mobile", status: "completed", createdAt }
    ];

    const [
      transactionTransferDeposit,
      transactionAuto,
      transactionDeposit,
      transactionTransferWithdrawl,
      transactionWithdrawl
    ] = await Promise.all(transactionQueries.map(query => this.transaction.find(query).select("amount").exec()));

    const sumAmounts = (transactions: any[]) => transactions.reduce((total, { amount }) => total + amount, 0);

    const totalDepositAmount = sumAmounts(transactionAuto) + sumAmounts(transactionTransferDeposit) + sumAmounts(transactionDeposit);
    const totalWithdrawlAmount = sumAmounts(transactionWithdrawl) + sumAmounts(transactionTransferWithdrawl);

    // User queries
    const userQueries = [
      { verified: true },
      { verified: true, status: true },
      { verified: true, status: false }
    ];

    const [allUsers, approvedUsers, unapprovedUsers] = await Promise.all(userQueries.map(query => this.user.countDocuments(query)));

    const tag = getBetData.market_tag
    const market_id = getBetData.market_id

    // Build query objects dynamically
    const baseQuery: any = { createdAt };
    if (tag) baseQuery.tag = tag;
    if (market_id) baseQuery.market_id = market_id;

    const winQuery: any = { win: "true", status: "completed", createdAt };
    if (tag) winQuery.tag = tag;
    if (market_id) winQuery.market_id = market_id;

    // Bet queries
    const betQueries = [baseQuery, winQuery];

    const [bets, winningBets] = await Promise.all(betQueries.map(query => this.bet.find(query).select(query === betQueries[0] ? "points" : "winning_amount").exec()));
    const sumBetPoints = (bets: any[]) => bets.reduce((total, { points }) => total + points, 0);
    const sumWinningAmounts = (bets: any[]) => bets.reduce((total, { winning_amount }) => total + winning_amount, 0);

    const totalBetAmount = sumBetPoints(bets);
    const totalBetWinAmount = sumWinningAmounts(winningBets);

    // Market queries
    const marketQueries = [
      { status: true },
      { tag: "main", status: true },
      { tag: "starline", status: true },
      { tag: "galidisawar", status: true }
    ];

    const [allMarkets, mainMarkets, starlineMarkets, galidisawarMarkets] = await Promise.all(marketQueries.map(query => this.market.countDocuments(query)));

    // User queries
    const agentQueries = [
      { type: "agent" },
    ];

    const [totalAgent] = await Promise.all(agentQueries.map(query => this.admin.countDocuments(query)));

    return {
      totalDepositAmount,
      totalWithdrawlAmount,
      allUsers,
      totalAgent,
      approvedUsers,
      unapprovedUsers,
      totalBetAmount,
      totalBetWinAmount,
      allMarkets,
      mainMarkets,
      starlineMarkets,
      galidisawarMarkets
    };
  }

  public async getTotalData(getBetData: TotalDataDto): Promise<any> {
    // Transaction queries
    const transactionQueries = [
      { transfer_type: "deposit", type: "transfer", status: "completed" },
      { transfer_type: "auto", status: "success", type: "mobile" },
      { transfer_type: "deposit", type: "mobile", status: "completed" },
      { transfer_type: "withdrawl", type: "transfer", status: "completed" },
      { transfer_type: "withdrawl", type: "mobile", status: "completed" }
    ];

    const [
      transactionTransferDeposit,
      transactionAuto,
      transactionDeposit,
      transactionTransferWithdrawl,
      transactionWithdrawl
    ] = await Promise.all(transactionQueries.map(query => this.transaction.find(query).select("amount").exec()));

    const sumAmounts = (transactions: any[]) => transactions.reduce((total, { amount }) => total + amount, 0);

    const totalDepositAmount = sumAmounts(transactionAuto) + sumAmounts(transactionTransferDeposit) + sumAmounts(transactionDeposit);
    const totalWithdrawlAmount = sumAmounts(transactionWithdrawl) + sumAmounts(transactionTransferWithdrawl);

    // User queries
    const userQueries = [
      { verified: true },
      { verified: true, status: true },
      { verified: true, status: false }
    ];

    const [allUsers, approvedUsers, unapprovedUsers] = await Promise.all(userQueries.map(query => this.user.countDocuments(query)));

    const tag = getBetData.market_tag
    const market_id = getBetData.market_id

    // Build query objects dynamically
    const baseQuery: any = {};
    if (tag) baseQuery.tag = tag;
    if (market_id) baseQuery.market_id = market_id;

    const winQuery: any = { win: "true", status: "completed" };
    if (tag) winQuery.tag = tag;
    if (market_id) winQuery.market_id = market_id;

    // Bet queries
    const betQueries = [baseQuery, winQuery];

    const [bets, winningBets] = await Promise.all(betQueries.map(query => this.bet.find(query).select(query === betQueries[0] ? "points" : "winning_amount").exec()));
    const sumBetPoints = (bets: any[]) => bets.reduce((total, { points }) => total + points, 0);
    const sumWinningAmounts = (bets: any[]) => bets.reduce((total, { winning_amount }) => total + winning_amount, 0);

    const totalBetAmount = sumBetPoints(bets);
    const totalBetWinAmount = sumWinningAmounts(winningBets);

    // Market queries
    const marketQueries = [
      { status: true },
      { tag: "main", status: true },
      { tag: "starline", status: true },
      { tag: "galidisawar", status: true }
    ];

    const [allMarkets, mainMarkets, starlineMarkets, galidisawarMarkets] = await Promise.all(marketQueries.map(query => this.market.countDocuments(query)));

    // User queries
    const agentQueries = [
      { type: "agent" },
    ];

    const [totalAgent] = await Promise.all(agentQueries.map(query => this.admin.countDocuments(query)));
    return {
      totalDepositAmount,
      totalWithdrawlAmount,
      allUsers,
      totalAgent,
      approvedUsers,
      unapprovedUsers,
      totalBetAmount,
      totalBetWinAmount,
      allMarkets,
      mainMarkets,
      starlineMarkets,
      galidisawarMarkets
    };
  }

  public async autoDeclare(): Promise<{ status: string, message: string, data: any[] }> {
    try {
      const url = 'https://dpbossattamatka.net/';
      const date = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(date.getTime() + istOffset);
      const query_date = istDate.toISOString().split('T')[0];

      // Fetching active markets
      const marketNameFilterArray = await this.market.find({ tag: "main", status: true, market_status: true })
        .select("name id")
        .sort({ createdAt: -1 });
      const dbMarketNames = marketNameFilterArray.map(market => upperCase(market.name));
      const dbMarketIDs = marketNameFilterArray.map(market => market.id);

      // Scrape data from the URL
      const marketData = await this.scrapeData(url, dbMarketNames, dbMarketIDs);

      // Filter out markets with "HOLIDAY" result but do not remove them from the list
      const filteredMarketData = marketData.filter(data => upperCase(data.result) !== 'HOLIDAY');

      // console.log("Filtered Market Data (without HOLIDAY):", filteredMarketData);

      const transformedMarketData = await this.transformData(filteredMarketData);
      // Extract the scraped market IDs (excluding HOLIDAY markets)
      const scrapedMarketIDs = filteredMarketData.map(data => data.marketId);

      const updatedData = await this.checkAndUpdateOrCreateResults(transformedMarketData, scrapedMarketIDs, query_date);

      return { status: 'success', message: "Operation successful", data: updatedData };
    } catch (err) {
      console.error(err);
      throw new Error('Failed to declare market results.');
    }
  }

  private async checkAndUpdateOrCreateResults(marketData: any[], marketIDs: string[], query_date: string): Promise<any[]> {
    const updatedResults = [];
    const { from, to } = convertFromTo(query_date);

    for (let i = 0; i < marketData.length; i++) {
      const data = marketData[i];

      const { open_panna, close_panna, open_digit, close_digit, marketName, marketId } = data;
      const market_id = marketId;
      let dataValueOpen, dataValueClose;
      if (open_panna && open_digit) {
        dataValueOpen = `${open_panna} - ${open_digit}`;
      }
      if (close_panna && close_digit) {
        dataValueClose = `${close_panna} - ${close_digit}`;
      }
      const existingResult = await this.resultCheck.findOne({ market_id: market_id });
      // await this.checkAndUpdateMarkets(market_id, open_time, close_time);
      const defaultSettings = await this.setting.findOne({ name: 'global' });
      if (!defaultSettings) throw new HttpException(404, 'Global settings not found');

      if (existingResult) {
        const updateData: any = {};
        let shouldDeclareOpen = false;
        let shouldDeclareClose = false;
        updateData.from = from;
        updateData.to = to;

        if ((existingResult.open_result !== dataValueOpen) && (open_panna !== undefined) && (open_digit !== undefined)) {
          updateData.open_result = dataValueOpen;
          shouldDeclareOpen = true;
        }
        if ((existingResult.close_result !== dataValueClose) && (close_panna !== undefined) && (close_digit !== undefined)) {
          updateData.close_result = dataValueClose;
          shouldDeclareClose = true;
        }

        if (Object.keys(updateData).length > 0) {
          const updatedResult = await this.resultCheck.findByIdAndUpdate(existingResult._id, { $set: updateData }, { new: true });
          updatedResults.push(updatedResult);

          if (defaultSettings.auto_declare) {
            if (shouldDeclareOpen) {
              await this.declareResultAuto({
                market_id,
                session: 'open',
                result_date: query_date,
                bet_status: 'closed',
                tag: 'main',
                digit: open_digit,
                panna: open_panna
              });
            }
            if (shouldDeclareClose) {
              await this.declareResultAuto({
                market_id,
                session: 'close',
                result_date: query_date,
                bet_status: 'closed',
                tag: 'main',
                digit: close_digit,
                panna: close_panna
              });
            }
          }
        } else {
          updatedResults.push(existingResult);
        }
      } else {
        const newResult = new this.resultCheck({
          open_result: dataValueOpen,
          close_result: dataValueClose,
          market_name: marketName,
          market_id,
          from,
          to
        });

        await newResult.save();
        updatedResults.push(newResult);
      }
    }

    return updatedResults;
  }

  private async checkAndUpdateMarkets(market_id: string, open_time: string, close_time: string) {
    const excludedMarketId = "66c3763183b8205804cd1ce6"; // Replace with the actual market ID to exclude

    // Check if the market is the one to exclude
    if (market_id === excludedMarketId) {
      // console.log(`Skipping market update for market_id: ${market_id}`);
      return; // Exit the function early if it's the excluded market
    }

    const existingMarket = await this.market.findOne({ _id: market_id });

    // Only proceed if the market exists and times differ
    if (existingMarket && (existingMarket.open_time !== open_time || existingMarket.close_time !== close_time)) {
      const updateMarketData: any = {
        open_time: open_time,
        close_time: close_time,
      };

      await this.market.findByIdAndUpdate(existingMarket._id, { $set: updateMarketData }, { new: true });
      // console.log(`Updated market timings for market_id: ${market_id}`);
    } else {
      // console.log(`No update required for market_id: ${market_id}`);
    }
  }

  // private async scrapeData(url: string, dbMarketNames: string[], dbMarketIDs: string[]): Promise<Array<{ marketName: string, result: string, time: string, marketId: string }>> {
  //   try {
  //     const response = await axios.get(url);
  //     if (!response || !response.data) {
  //       console.error('No data returned from the request');
  //       return [];
  //     }

  //     const $ = cheerio.load(response.data);
  //     const marketNames = $('.tkt-val h4');
  //     const results = $('.tkt-val span');
  //     const times = $('.tkt-val p');

  //     const marketData: Array<{ marketName: string, result: string, time: string, marketId: string }> = [];

  //     marketNames.each((index, element) => {
  //       const marketName = $(element).text().trim();
  //       const marketIndex = dbMarketNames.indexOf(upperCase(marketName));
  //       if (marketIndex !== -1) { // Only include markets that exist in the db
  //         const result = $(results[index]).text().trim();
  //         const time = $(times[index]).text().trim();
  //         const marketId = dbMarketIDs[marketIndex]; // Get the ID corresponding to the name

  //         marketData.push({ marketName, result, time, marketId });
  //       }
  //     });

  //     return marketData;
  //   } catch (error) {
  //     console.error('Error scraping the website:', error);
  //     return [];
  //   }
  // }

  private async scrapeData(url: string, dbMarketNames: string[], dbMarketIDs: string[]): Promise<Array<{ marketName: string, result: string, time: string, marketId: string }>> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          timeout: 10000, // 10 second timeout
        });

        if (!response || !response.data) {
          console.error('No data returned from the request');
          return [];
        }

        const $ = cheerio.load(response.data);
        const marketNames = $('.tkt-val h4');
        const results = $('.tkt-val span');
        const times = $('.tkt-val p');

        const marketData: Array<{ marketName: string, result: string, time: string, marketId: string }> = [];

        marketNames.each((index, element) => {
          const marketName = $(element).text().trim();
          const marketIndex = dbMarketNames.indexOf(upperCase(marketName));
          if (marketIndex !== -1) {
            const result = $(results[index]).text().trim();
            const time = $(times[index]).text().trim();
            const marketId = dbMarketIDs[marketIndex];

            marketData.push({ marketName, result, time, marketId });
          }
        });

        return marketData;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff

        if (isLastAttempt) {
          console.error(`Failed to scrape data after ${maxRetries} attempts:`, error.message);
          return [];
        }

        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return [];
  }

  private async transformData(marketData: any[]): Promise<any[]> {
    try {
      return marketData.map(entry => {
        const { marketName, result, time, marketId } = entry;

        // Check if result is valid
        if (!result || typeof result !== 'string') {
          console.error(`Invalid result format: ${result}`);
          return null; // Skip this entry
        }
        // Extracting parts of the result
        const parts = result.split('-');

        // Ensure we have the expected parts
        if (parts.length < 2) {
          console.error(`Unexpected result format: ${result} in ${marketName}`);
          return null; // Skip this entry
        }

        const [openPanna, digits, closePanna] = parts;

        const openDigit = digits.slice(0, 1); // First character
        const closeDigit = digits.slice(1, 2); // Second character

        // Extracting and converting time parts with flexible space handling
        const timeParts = time.split(/\s+/); // Split on one or more spaces
        // Check if timeParts has enough elements
        if (timeParts.length < 4) {
          console.error(`Unexpected time format: ${time}`);
          return null; // Skip this entry
        }
        const openTimeRaw = timeParts[0] + " " + timeParts[1]; // Reconstruct first time with AM/PM
        const closeTimeRaw = timeParts[2] + " " + timeParts[3]; // Reconstruct second time with AM/PM

        // Safely apply trim and convert to 24-hour format
        const openTime = this.convertTo24Hour(openTimeRaw.trim());
        const closeTime = this.convertTo24Hour(closeTimeRaw.trim());
        return {
          marketName,
          marketId,
          open_panna: openPanna,
          open_digit: openDigit,
          close_digit: closeDigit,
          close_panna: closePanna,
          open_time: openTime,
          close_time: closeTime
        };
      }).filter(entry => entry !== null); // Filter out any null entries
    } catch (error) {
      console.error('Error transforming the data:', error);
      return [];
    }
  }

  private convertTo24Hour(timeStr: string): string {
    const [time, modifier] = timeStr.split(' ');
    // eslint-disable-next-line prefer-const
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00'; // Convert 12 AM to 00
    }
    if (modifier === 'PM' && hours !== '12') {
      hours = (parseInt(hours, 10) + 12).toString(); // Convert PM hour to 24-hour format
    }
    return `${hours.padStart(2, '0')}:${minutes}`; // Ensure two digit hours
  }

  private async declareResultAuto(resultData: DeclareResultDto): Promise<void> {
    // if (!resultData.market_id) throw new HttpException(400, 'Market ID is required');
    const { market_id, session, result_date, bet_status, tag, digit, panna } = resultData;
    // console.log(result_date);

    const { from, to } = convertFromTo(result_date)
    const result = [panna, digit]

    if (!market_id) throw new HttpException(400, 'Need market ID');

    const foundMarket = await this.market.findById(market_id);
    if (!foundMarket) throw new HttpException(404, 'No market found for the given ID');
    if (!foundMarket.market_status) throw new HttpException(400, 'Today market is not open');

    const defaultSettings = await this.setting.findOne({ name: 'global' });
    if (!defaultSettings) throw new HttpException(404, 'Global settings not found');

    const rates = tag === 'main' ? defaultSettings?.rates?.main : defaultSettings?.rates?.starline;
    if (!rates) throw new HttpException(400, `Set rates for ${tag} games`);

    const givenDate = new Date(to).setUTCHours(0, 0, 0, 0);
    const currentDate = new Date().setUTCHours(0, 0, 0, 0);

    if (givenDate >= currentDate) {
      const marketKeyPrefix = session === 'open' ? 'open' : session === 'close' ? 'close' : null;
      if (marketKeyPrefix) {
        foundMarket[`${marketKeyPrefix}_digit`] = digit;
        foundMarket[`${marketKeyPrefix}_panna`] = panna;
      }
    }

    const foundResult = await this.result.find({ market_id, tag, from, to }).sort({ from: -1 });
    if (foundResult.length === 0 && session === 'close') {
      throw new HttpException(400, `First declare open result ${foundMarket.name}`);
    }

    let open_digit: any, close_digit: any, open_panna: any, close_panna: any;
    if (session === 'open') {
      ({ digit: open_digit, panna: open_panna } = { digit, panna });
    } else {
      ({ digit: close_digit, panna: close_panna } = { digit, panna });
    }

    let updateResult: any;
    if (foundResult.length === 0) {
      updateResult = new this.result({ market_id, from, to, tag, market_name: foundMarket.name });
      if (session === 'open') {
        updateResult.open_declare = new Date();
        updateResult.open_result = `${panna} - ${digit}`;
      } else if (session === 'close') {
        updateResult.close_declare = new Date();
        updateResult.close_result = `${panna} - ${digit}`;
      }
      await updateResult.save();
    } else {
      const matchedResult = await this.result.findById(foundResult[0]._id);
      if ((matchedResult.open_result && matchedResult.close_result) ||
        (matchedResult.open_result && session === 'open') ||
        (matchedResult.close_result && session === 'close')) {
        throw new HttpException(400, `Can't re-declare result ${foundMarket.name}`);
      }

      if (session === 'open') {
        matchedResult.open_declare = new Date();
        matchedResult.open_result = `${panna} - ${digit}`;
      } else if (session === 'close') {
        matchedResult.close_declare = new Date();
        matchedResult.close_result = `${panna} - ${digit}`;
      }
      await matchedResult.save();

      if (matchedResult.open_result) {
        [open_panna, , open_digit] = matchedResult.open_result.split(' ');
      }
      if (matchedResult.close_result) {
        [close_panna, , close_digit] = matchedResult.close_result.split(' ');
      }
    }

    await foundMarket.save();

    const queryObject = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running',
      session: 'open'
    };
    const queryObjectClose = {
      createdAt: { $gte: from, $lt: to },
      market_id,
      status: 'running'
    };

    const updatedBets = session === 'open' ? await this.bet.find(queryObject).populate('user_id') : await this.bet.find(queryObjectClose).populate('user_id');

    if (defaultSettings.auto_notification) {
      const forResult = session === 'open' ? `${open_panna} - ${open_digit}` : `${open_panna} - ${open_digit}${close_digit} - ${close_panna}`;

      let firebaseMessage;
      let firebaseTitle;
      if (tag === "starline") {
        firebaseTitle = `STARLINE: ${foundMarket.name}`
        firebaseMessage = `Declare Result: ${forResult}`;
      } else if (tag === "main") {
        firebaseTitle = `Market name: ${foundMarket.name}`;
        firebaseMessage = session === "open" ? `Open Declare Result: ${forResult}` :
          session === "close" ? `Close Declare Result: ${forResult}` : `Declare Result: ${forResult}`;
      }
      const notificationKeyMap: { [key: string]: string } = {
        main: "main_notification",
        starline: "starline_notification",
      };

      const notificationKey = notificationKeyMap[tag];
      const queryUser = { status: true, verified: true, [notificationKey]: true };
      const userList = await this.user.find(queryUser);

      const removeTokenFromDatabase = async (userId: any) => {
        try {
          // Update the user's FCM token to "-" in the database
          await this.user.updateOne({ _id: userId }, { $set: { fcm: "-" } });
          console.log(`Invalid FCM token removed for user: ${userId}`);
        } catch (error) {
          console.error(`Error removing FCM token for user: ${userId}`, error);
        }
      };

      const sendNotifications = async () => {
        const promises = userList.map(async (user) => {
          if (user.fcm !== '-') {
            const message = {
              notification: {
                title: firebaseTitle,
                body: firebaseMessage
              },
              token: user.fcm
            };

            try {
              await firebase.messaging().send(message);
            } catch (error) {
              console.error('Error sending message:', error);
              if (error) {
                // Remove the invalid token from your database
                await removeTokenFromDatabase(user.id);
              }
            }
          }
        });

        await Promise.all(promises);
      };
      await sendNotifications();
    }
    // console.log("open_digit", open_digit, "close_digit", close_digit, "open_panna", open_panna, "close_panna", close_panna)

    for (const betItem of updatedBets) {
      betItem.result = result;
      if (bet_status !== 'cancelled') {
        // const transactionData = {
        //   user_id: betItem.user_id,
        //   type: 'bet',
        //   note: 'bet closed',
        //   status: 'completed',
        //   bet_id: betItem._id,
        //   market_id
        // };

        const foundUser = await this.user.findById(betItem.user_id);
        if (!foundUser) continue;

        const updateTransaction = async (win: boolean, amountChange: number) => {
          // console.log('wallet', foundUser.wallet);
          // const newTransaction = new this.transaction({
          //   ...transactionData,
          //   prev_balance: foundUser.wallet,
          //   current_balance: foundUser.wallet,
          //   amount: amountChange,
          //   transfer_type: win ? 'win' : 'lose'
          // });

          if (win) {
            foundUser.wallet += amountChange;
            // newTransaction.current_balance = foundUser.wallet;
          }

          await foundUser.save();
          // const savedTransaction = await newTransaction.save();
          // betItem.transaction = savedTransaction._id;
          betItem.bet_amount = betItem.points;
          betItem.winning_amount = amountChange;
          betItem.status = bet_status;
          betItem.win = win ? 'true' : 'false';
          await betItem.save();
        };

        const calculateWinnings = (rate1: number, rate2: number) => Math.floor((betItem.points / rate1) * rate2);

        const gameModes = {
          'single-digit': {
            rate1: rates.single_digit_1,
            rate2: rates.single_digit_2,
            condition: session === 'open'
              ? Number(open_digit) === Number(betItem.open_digit)
              : Number(close_digit) === Number(betItem.close_digit)
          },
          'double-digit': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'single-panna': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'double-panna': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'full-sangum': {
            rate1: rates.full_sangum_1,
            rate2: rates.full_sangum_2,
            condition: Number(open_panna) === Number(betItem.open_panna) && Number(close_panna) === Number(betItem.close_panna)
          },
          'half-sangum': {
            rate1: rates.half_sangum_1,
            rate2: rates.half_sangum_2,
            condition: betItem.close_digit === '-'
              ? Number(open_digit) === Number(betItem.open_digit) && Number(close_panna) === Number(betItem.close_panna)
              : Number(close_digit) === Number(betItem.close_digit) && Number(open_panna) === Number(betItem.open_panna)
          },
          'triple-panna': {
            rate1: rates.tripple_panna_1,
            rate2: rates.tripple_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'sp-mortor': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'dp-mortor': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'even-odd-digit': {
            rate1: rates.even_odd_digit_1,
            rate2: rates.even_odd_digit_2,
            condition: session === 'open'
              ? Number(open_digit) === Number(betItem.open_digit)
              : Number(close_digit) === Number(betItem.close_digit)
          },
          'double-even-odd': {
            rate1: rates.double_even_odd_1,
            rate2: rates.double_even_odd_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'sp-dp-tp': {
            rate1: null,
            rate2: null,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna),
            subRates: {
              sp: { rate1: rates.single_panna_1, rate2: rates.single_panna_2 },
              dp: { rate1: rates.double_panna_1, rate2: rates.double_panna_2 },
              tp: { rate1: rates.tripple_panna_1, rate2: rates.tripple_panna_2 }
            }
          },
          'jodi-bulk': {
            rate1: rates.jodi_digit_1,
            rate2: rates.jodi_digit_2,
            condition: Number(open_digit) === Number(betItem.open_digit) && Number(close_digit) === Number(betItem.close_digit)
          },
          'single-panna-bulk': {
            rate1: rates.single_panna_1,
            rate2: rates.single_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          },
          'double-panna-bulk': {
            rate1: rates.double_panna_1,
            rate2: rates.double_panna_2,
            condition: session === 'open'
              ? Number(open_panna) === Number(betItem.open_panna)
              : Number(close_panna) === Number(betItem.close_panna)
          }
        };

        const gameMode = gameModes[betItem.game_mode];
        if (gameMode) {
          let winningAmount = 0;
          let win = false;
          if (betItem.game_mode === 'sp-dp-tp') {
            const subModeRates = gameMode.subRates[betItem.sub_mode];
            if (subModeRates && gameMode.condition) {
              winningAmount = calculateWinnings(subModeRates.rate1, subModeRates.rate2);
              win = true;
            }
          } else if (gameMode.condition) {
            winningAmount = calculateWinnings(gameMode.rate1, gameMode.rate2);
            win = true;
          }
          await updateTransaction(win, winningAmount);
        }
      }
    }
    console.log(`Successfully declared result for ${resultData.session} session in ${foundMarket.name}`);
  }

}

export default MarketService;