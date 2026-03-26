import { HttpException } from '@exceptions/HttpException';
import { ObjectId } from 'mongodb';
import { checkMarketTime, convertFromTo, isEmpty } from '@utils/util';
import BetModel from '@/models/bet.model';
import { Bet, GetAllBet, GetUserBet, PointsBet } from '@/interfaces/bet.interface';
import { CreateBetDto, GetUserBetDto, PointsBetDto, PonitsBetAllDto, ProfitBetDto, UpdateBetDto } from '@/dtos/bet.dto';
import UserModel from '@/models/user.model';
import MarketModel from '@/models/market.model';
import { Market } from '@/interfaces/market.interface';
import SettingModel from '@/models/setting.model';
import ResultModel from '@/models/result.model';
import AdminModel from '@/models/admin.model';

class BetService {
  public bet = BetModel;
  public user = UserModel;
  public admin = AdminModel;
  public market = MarketModel;
  public setting = SettingModel;
  public result = ResultModel;

  public async create(betData: CreateBetDto[]): Promise<Bet[]> {
    if (isEmpty(betData)) {
      throw new HttpException(400, 'betData is empty');
    }

    const totalPoints = betData.reduce((acc, entry) => acc + entry.points, 0);

    const foundUser = await this.user.findById(betData[0].user_id).select(['bets', 'wallet', 'betting', 'verified', 'status', 'agent']);
    
    let foundAgent: any
    if (foundUser.agent !== undefined) {
      foundAgent = await this.admin.findById(foundUser.agent).select(['wallet', 'status', 'commission', 'type']);
    }

    if (!foundUser) {
      throw new HttpException(404, 'User not found');
    }

    const remainingWalletBalance = Number(foundUser.wallet) - totalPoints;
    if (remainingWalletBalance < 0) {
      throw new HttpException(409, 'Not enough money in wallet');
    }
    // betting true = locked; betting false = allowed. verified and status must be true to bet.
    if (foundUser.betting || !foundUser.verified || !foundUser.status) {
      throw new HttpException(409, 'User not allowed to bet');
    }

    const marketData: Market = await this.market.findById(betData[0].market_id);
    if (!marketData.market_status) {
      throw new HttpException(400, 'Today market is not open');
    }

    const gamelist = await checkMarketTime(marketData);
    if (!gamelist[betData[0].game_mode]) {
      throw new HttpException(409, 'Market time is up');
    }

    const insertData = betData.map(obj => ({ ...obj, market_name: marketData.name, user_bal: foundUser.wallet, agent_id: foundAgent ? foundAgent.id : undefined, commission: foundAgent ? foundAgent.commission : 0 }));
    const createBetData = await this.bet.insertMany(insertData);
    if (foundAgent?.status && foundAgent.type === "agent"){
      foundAgent.wallet += parseFloat(Math.round((totalPoints * foundAgent.commission) / 100).toFixed(2));
      await foundAgent.save();
    }

    foundUser.wallet -= totalPoints;
    createBetData.forEach(async (bet) => {
      foundUser.bets.push(bet.id);
    });

    await foundUser.save();

    return createBetData;
  }

  public async updateBetArray(betData: UpdateBetDto): Promise<void> {
    const { id, open_digit, close_digit, open_panna, close_panna } = betData;
    if (!id) {
      throw new HttpException(400, 'Need bet ID');
    }
    const foundBet = await this.bet.findById(id);
    if (!foundBet) {
      throw new HttpException(404, 'Incorrect bet ID');
    }
    if (open_digit !== undefined) foundBet.open_digit = open_digit;
    if (close_digit !== undefined) foundBet.close_digit = close_digit;
    if (open_panna !== undefined) foundBet.open_panna = open_panna;
    if (close_panna !== undefined) foundBet.close_panna = close_panna;
    await foundBet.save();
  }

  public async getPointsAmount(pointsData: PointsBetDto): Promise<PointsBet[]> {
    if (isEmpty(pointsData)) {
      throw new HttpException(400, 'pointsData is empty');
    }
    const currentDate = new Date().toISOString().split('T')[0];
    const { from, to } = convertFromTo(currentDate);
    interface QueryObj {
      $match: {
        market_id?: ObjectId;
        session?: string;
        game_mode?: { $in: string[] };
        createdAt: {
          $gte: Date;
          $lt: Date;
        };
      };
    }
    const query: QueryObj = {
      $match: {
        market_id: new ObjectId(pointsData.market_id),
        session: pointsData.session,
        game_mode: { $in: ["single-digit", "even-odd-digit"] },
        createdAt: {
          $gte: new Date(from),
          $lt: new Date(to)
        }
      }
    };
    let typeName: string
    if (pointsData.session === "open") {
      typeName = "open_digit";
    } else {
      typeName = "close_digit";
    }
    const match = {
      $group: {
        _id: '$' + typeName,
        total_points: { $sum: '$points' },
        count: { $sum: 1 }
      }
    };
    const results = await this.bet.aggregate([query, match])
    return results;
  }

  public async getBet(getBetData: GetAllBet): Promise<{ total: number; bet_list: any }> {
    const query: GetAllBet = { ...getBetData };

    const user_info: any = query.user_info || null;
    const skip: number = query.skip ? Number(query.skip) : 0;
    const count: number = query.count ? Number(query.count) : undefined;
    delete query.user_info;
    delete query.skip;
    delete query.count;

    // Clean up undefined fields from the query
    for (const key in query) {
      if (query[key] === undefined) {
        delete query[key];
      }
    }

    const total = await this.bet.countDocuments(query); // Total number of bets
    const limit = count !== undefined ? Number(count) : total; // Limit for pagination

    let bet_list = [];
    const sortField = query.win ? 'updatedAt' : 'createdAt';
    const sortOption: any = {};
    sortOption[sortField] = -1;

    const queryBuilder = user_info
      ? this.bet.find(query).select("-user_bal")
      .populate({ path: 'user_id', select: 'user_name mobile' }) // only name & email from user
      .populate({ path: 'agent_id', select: 'name mobile type' }) 
      : this.bet.find(query).select("-user_bal").populate({ path: 'agent_id', select: 'name mobile type' })

    bet_list = await queryBuilder.skip(skip * limit).limit(limit).sort(sortOption);

    return { total: total, bet_list: bet_list };
  }

  public async getUserBet(getBetData: GetUserBetDto) {
    if (isEmpty(getBetData.user_id)) throw new HttpException(400, 'user betData is empty');
    const user = await this.user.findById({ _id: getBetData.user_id })
    if (!user) {
      throw new HttpException(404, 'User not found');
    }
    let from, to;
    if (getBetData.from_date && getBetData.to_date) {
      const f_date = new Date(getBetData.from_date);
      const t_date = new Date(getBetData.to_date);

      f_date.setUTCDate(f_date.getUTCDate() - 1);

      from = `${f_date.toISOString().split('T')[0]}T18:30:00.000Z`;
      to = `${t_date.toISOString().split('T')[0]}T18:29:59.999Z`;
    }

    const query: GetUserBet = {};
    if (getBetData.user_id !== undefined) query.user_id = String(getBetData.user_id);
    if (getBetData.tag !== undefined) query.tag = String(getBetData.tag);
    if (getBetData.win !== undefined) query.win = String(getBetData.win);
    if (getBetData.market_id !== undefined) query.market_id = String(getBetData.market_id);
    if (getBetData.game_mode !== undefined) query.game_mode = String(getBetData.game_mode);
    if (getBetData.from_date && getBetData.to_date) query.createdAt = { $gte: String(from), $lt: String(to) };

    const total = await this.bet.countDocuments(query);
    const bet_list = await this.bet.find(query).select("-user_bal").populate({ path: 'user_id', select: 'user_name mobile' }).sort({ createdAt: -1 });

    if (!bet_list) {
      throw new HttpException(400, 'Error getting bet list');
    }

    return { total, bet_list };
  }

  // public async getAllPointsAmount(BetData: PonitsBetAllDto): Promise<any[]> {
  //   if (isEmpty(BetData)) {
  //     throw new HttpException(400, 'betData is empty');
  //   }
  //   const { market_id, game_mode, session, query_date, tag } = BetData;

  //   const {from, to} = convertFromTo(query_date);

  //   const query: any = {
  //     market_id: market_id,
  //     tag: tag,
  //     createdAt: { $gte: new Date(from), $lt: new Date(to) },
  //   };
  //   if (tag !== "galidisawar") {
  //     query.session = session;
  //   }
  //   if (game_mode) {
  //     query.game_mode = game_mode;
  //   }
  //   const data = await this.bet.find(query);


  //   console.log(data);

  //   const aggregatedData: any = {};
  //   const gameModesMap: { [key: string]: string[] } = {
  //     "galidisawar": ["jodi-digit", "right-digit", "left-digit"],
  //     "starline": ["single-digit", "single-panna", "double-panna", "triple-panna", "even-odd-digit"],
  //     "main": [
  //       "jodi-digit", "right-digit", "left-digit", "single-digit", "double-digit",
  //       "single-panna", "double-panna", "triple-panna", "even-odd-digit",
  //       "full-sangum", "half-sangum", "sp-dp-tp", "sp-mortor", "dp-mortor",
  //       "double-even-odd"
  //     ]
  //   };
  //   const gameModes: any = gameModesMap[tag];

  //   gameModes.forEach(mode => {
  //     const modeData = data.filter(entry => entry.game_mode === mode);
  //     const modeAggregatedData: any = {};

  //     modeData.forEach(entry => {
  //       let key;
  //       const singleDigitModes = ["single-digit", "even-odd-digit"];
  //       const galiDigitModes = ["right-digit", "left-digit"];
  //       const singlePannaModes = ["right-digit", "left-digit", "single-digit", "even-odd-digit", "single-panna", "triple-panna", "double-panna",
  //         "sp-dp-tp", "sp-mortor", "dp-mortor"];
  //       const doubleDigitModes = ["double-digit", "double-even-odd", "jodi-digit"];

  //       if (singlePannaModes.includes(mode)) {
  //         if (singleDigitModes.includes(mode)) {
  //           key = session === "open" ? entry.open_digit : entry.close_digit;
  //         } else {
  //           key = session === "open" ? entry.open_panna : entry.close_panna;
  //         }
  //         if (galiDigitModes.includes(mode)) {
  //           key = mode === "left-digit" ? entry.open_digit : entry.close_digit;
  //         }
  //       } else if (doubleDigitModes.includes(mode)) {
  //         key = entry.open_digit + entry.close_digit;
  //       } else if (mode === "full-sangum") {
  //         key = `Open Panna: ${entry.open_panna}, Close Panna: ${entry.close_panna}`;
  //       } else if (mode === "half-sangum") {
  //         if (entry.open_digit !== "-") {
  //           key = "Open Digit: " + entry.open_digit + ", " + "Close Panna: " + entry.close_panna;
  //         } else if (entry.close_digit !== "-") {
  //           key = "Close Digit: " + entry.close_digit + ", " + "Open Panna: " + entry.open_panna;
  //         }
  //       }

  //       if (key) {
  //         if (!modeAggregatedData[key]) {
  //           modeAggregatedData[key] = {
  //             _id: key,
  //             total_points: entry.points,
  //             count: 1
  //           };
  //         } else {
  //           modeAggregatedData[key].total_points += entry.points;
  //           modeAggregatedData[key].count++;
  //         }
  //       }
  //     });

  //     aggregatedData[mode] = Object.values(modeAggregatedData);
  //     // console.log("aggregatedData",aggregatedData);
  //   });
  //   return aggregatedData;
  // }

  public async getAllPointsAmount(BetData: PonitsBetAllDto): Promise<any> {
    if (isEmpty(BetData)) {
      throw new HttpException(400, 'Bet data is empty');
    }
    const { market_id, session, query_date, tag, game_mode } = BetData;
    const { from, to } = convertFromTo(query_date);

    const query: any = {
      market_id,
      tag,
      createdAt: { $gte: new Date(from), $lt: new Date(to) }
    };
    const queryResult: any = {
      market_id,
      createdAt: { $gte: new Date(from), $lt: new Date(to) }
    };

    if (game_mode) {
      query.game_mode = game_mode;
    }

    // if (tag !== "galidisawar") {
    //   query.session = session;
    // }

    const data = await this.bet.find(query);
    const resultdata = await this.result.find(queryResult);
    let panna
    let digit
    if (resultdata[0]) {
      panna = resultdata[0].open_result.split("-")[0]
      digit = resultdata[0].open_result.split("-")[1]
    }

    // Initialize aggregatedData with all possible game modes
    const aggregatedData: any = {
      "left-digit": [],
      "right-digit": [],
      "jodi-digit": [],
      "single-digit": [],
      "double-digit": [],
      "single-panna": [],
      "double-panna": [],
      "triple-panna": [],
      "full-sangum": [],
      "half-sangum": [],
    };

    data.forEach(entry => {
      let key;
      let targetCategory = entry.game_mode;

      switch (entry.game_mode) {
        case 'even-odd-digit':
          key = entry.session === "open" ? entry.open_digit : entry.close_digit;
          targetCategory = 'single-digit';  // Redirect to single-digit
          break;
        case 'double-even-odd':
          if (session === "open") {
            key = entry.open_digit + entry.close_digit;
          }
          if ((session === "close" && digit)) {
            if (Number(digit) === Number(entry.open_digit)) {
              key = entry.open_digit + entry.close_digit
            }
          } else {
            key = entry.open_digit + entry.close_digit
          }
          targetCategory = 'double-digit';  // Redirect to double-digit
          break;
        case 'sp-dp-tp':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          if (entry.sub_mode === "sp") {
            targetCategory = 'single-panna';  // Redirect to specific panna based on sub_mode
          }
          if (entry.sub_mode === "dp") {
            targetCategory = 'double-panna';  // Redirect to specific panna based on sub_mode
          }
          if (entry.sub_mode === "tp") {
            targetCategory = 'triple-panna';  // Redirect to specific panna based on sub_mode
          }
          break;
        case 'sp-mortor':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          targetCategory = 'single-panna';
          break;
        case 'dp-mortor':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          targetCategory = 'double-panna';
          break;
        case 'half-sangum':
          if (session === "open") {
            if (entry.open_digit !== "-") {
              key = "Open Digit: " + entry.open_digit + ", " + "Close Panna: " + entry.close_panna;
            } else if (entry.close_digit !== "-") {
              key = "Close Digit: " + entry.close_digit + ", " + "Open Panna: " + entry.open_panna;
            }
          }
          if ((session === "close" && panna)) {
            if ((Number(panna) === Number(entry.open_panna)) || (Number(digit) === Number(entry.open_digit))) {
              if (entry.open_digit !== "-") {
                key = "Open Digit: " + entry.open_digit + ", " + "Close Panna: " + entry.close_panna;
              } else if (entry.close_digit !== "-") {
                key = "Close Digit: " + entry.close_digit + ", " + "Open Panna: " + entry.open_panna;
              }
            }
          } else {
            if (entry.open_digit !== "-") {
              key = "Open Digit: " + entry.open_digit + ", " + "Close Panna: " + entry.close_panna;
            } else if (entry.close_digit !== "-") {
              key = "Close Digit: " + entry.close_digit + ", " + "Open Panna: " + entry.open_panna;
            }
          }
          // if (entry.open_digit !== "-") {
          //   key = "Open Digit: " + entry.open_digit + ", " + "Close Panna: " + entry.close_panna;
          // } else if (entry.close_digit !== "-") {
          //   key = "Close Digit: " + entry.close_digit + ", " + "Open Panna: " + entry.open_panna;
          // }
          targetCategory = 'half-sangum';
          break;
        case 'full-sangum':
          if (session === "open") {
            key = `Open Panna: ${entry.open_panna}, Close Panna: ${entry.close_panna}`;
          }
          if ((session === "close" && panna)) {
            if (Number(panna) === Number(entry.open_panna)) {
              key = `Open Panna: ${entry.open_panna}, Close Panna: ${entry.close_panna}`
            }
          } else {
            key = `Open Panna: ${entry.open_panna}, Close Panna: ${entry.close_panna}`
          }
          // key = `Open Panna: ${entry.open_panna}, Close Panna: ${entry.close_panna}`;
          targetCategory = 'full-sangum';
          break;
        case 'single-digit':
          key = entry.session === "open" ? entry.open_digit : entry.close_digit;
          targetCategory = 'single-digit';  // Redirect to single-digit
          break;
        case 'double-digit':
          if (session === "open") {
            key = entry.open_digit + entry.close_digit;
          }
          if ((session === "close" && digit)) {
            if (Number(digit) === Number(entry.open_digit)) {
              key = entry.open_digit + entry.close_digit
            }
          } else {
            key = entry.open_digit + entry.close_digit
          }
          targetCategory = 'double-digit';  // Redirect to double-digit
          break;
        case 'single-panna':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          targetCategory = 'single-panna';
          break;
        case 'single-panna-bulk':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          targetCategory = 'single-panna';
          break;
        case 'double-panna':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          targetCategory = 'double-panna';
          break;
        case 'double-panna-bulk':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          targetCategory = 'double-panna';
          break;
        case 'triple-panna':
          key = entry.session === "open" ? entry.open_panna : entry.close_panna;
          targetCategory = 'triple-panna';
          break;
        case 'jodi-bulk':
          if (session === "open") {
            key = entry.open_digit + entry.close_digit;
          }
          if ((session === "close" && digit)) {
            if (Number(digit) === Number(entry.open_digit)) {
              key = entry.open_digit + entry.close_digit
            }
          } else {
            key = entry.open_digit + entry.close_digit
          }
          targetCategory = 'double-digit';  // Redirect to double-digit
          break;
        case 'left-digit':
          key = entry.open_digit;
          targetCategory = 'left-digit';  // Redirect to single-digit
          break;
        case 'right-digit':
          key = entry.close_digit;
          targetCategory = 'right-digit';  // Redirect to single-digit
          break;
        case 'jodi-digit':
          key = entry.open_digit + entry.close_digit;
          targetCategory = 'jodi-digit';  // Redirect to double-digit
          break;
      }

      if (key && aggregatedData[targetCategory]) {
        const index = aggregatedData[targetCategory].findIndex(item => item._id === key);
        if (index !== -1) {
          aggregatedData[targetCategory][index].total_points += entry.points;
          aggregatedData[targetCategory][index].count += 1;
        } else {
          aggregatedData[targetCategory].push({
            _id: key,
            total_points: entry.points,
            count: 1
          });
        }
      }
    });

    return aggregatedData;
  }

  public async getProfitLossAmount(query_date: ProfitBetDto) {
    const date = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC +5:30, so the offset is 330 minutes in milliseconds
    const istDate = new Date(date.getTime() + istOffset);
    const query_Date = istDate.toISOString().split('T')[0];
    const { from, to } = convertFromTo(query_date.query_date || query_Date);

    const query = { createdAt: { $gte: from, $lt: to } };
    const queryWin = { ...query, win: "true", };

    const betList = await this.bet.find(query).select("points").exec();
    const betWinList = await this.bet.find(queryWin).select("winning_amount").exec();

    const totalBetAmount = betList.reduce((total, item) => total + item.points, 0);
    const totalBetWinAmount = betWinList.reduce((total, item) => total + item.winning_amount, 0);

    const result = totalBetAmount === totalBetWinAmount
      ? { amount: 0, data: "-" }
      : totalBetAmount > totalBetWinAmount
        ? { amount: totalBetAmount - totalBetWinAmount, data: "profit" }
        : { amount: totalBetWinAmount - totalBetAmount, data: "loss" };

    return { status: "successful", result };
  }

  public convertUTCtoIST(utcDate: Date): Date {
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    return new Date(utcDate.getTime() + istOffset);
  }

}

export default BetService;
