import { Command, CommandReturn } from "../models/ICommands";
import { MatchEventType, MatchTeam, MatchTeamType, OMatchesSchema, OMatchEventSchema, osuApiV2 as osuApi, OUserSchema2 } from "../../OsuApiV2";

/**
 * While I was implementing the BathBot formula, I found a difference between the formula and its implementation in the BathBot (osuplus) code. 
 * I don't know if this was intentional or a mistake
 * Formula: https://imgur.com/7KFwcUS
 * 
 * - At the beginning of the modsCombination array there's an empty string, this is (maybe) because they aren't filtering when players go without mods and the api returns an empty mod array
 */
export default <Command>{
    commandEnum: "MC",
    defaultPermission: true,
    name: "matchcosts",
    description: "Calculate a performance rating for each player in the given multiplayer match",
    options: [
        {
            name: "matchid",
            description: "Match url or match id",
            type: "STRING",
            required: true
        },
        {
            name: "warmups",
            description: "Amount of played warmups. Default value: 2",
            type: "INTEGER",
            required: false
        },
        {
            name: "formula",
            description: "Formula with which the calculations will be made",
            type: "STRING",
            choices: ["osuplus", "bathbot", "flashlight"].map(types => ({
                name: types,
                value: types,
            })),
            required: false
        }
    ],
    async call({ interaction }): Promise<CommandReturn> {
        try {
            const regexp = /((http|https):\/\/(osu|old).ppy.sh\/(community\/matches|mp)\/)?(\d+)/g;
            const matchID = interaction.options.getString("matchid");
            const formula = (interaction.options.getString("formula", false) || "bathbot") as "osuplus" | "bathbot" | "flashlight";
            const regexMatch = regexp.exec(matchID);

            if (!['osuplus', 'bathbot', 'flashlight'].includes(formula)) return;
            
            const match = (await osuApi.fetchMatch(
                Number(regexMatch[5])
            )) as OMatchesSchema;

            if (!match) {
                return {
                    message: {
                        content: "The multiplayer lobby couldn't be found"
                    }
                }
            } else {
                if (match.events[0].detail.type !== MatchEventType.MatchCreated) {
                    let partMatch: OMatchesSchema = {
                        events: [], 
                        users: []
                    };
                    do {
                        partMatch = await osuApi.fetchMatch(
                            Number(regexMatch[5]),
                            match.events[0].id
                        ) as OMatchesSchema;
                        for (const event of partMatch.events.reverse()) {
                            match.events.unshift(event);
                        }
                    } while (match.events[0].detail.type !== MatchEventType.MatchCreated)
                }
            }

            const userStats: OUserStatsSchema[] = [];
            const userList: OUserListSchema[] = [];
            const teamResults: OMatchResultSchema = {
                blue: 0,
                red: 0,
                none: 0
            };
            let totalGames = 0;
            let isTeamVersus = null;

            const onlyGameEvents: OMatchEventSchema[] = [];

            for (const event of match.events) {
                if (Object.prototype.hasOwnProperty.call(event, "game")) {
                    onlyGameEvents.push(event);
                }
            }

            for (const indexEvent in onlyGameEvents) {
                const teamScore: OMatchResultSchema = {
                    blue: 0,
                    red: 0,
                    none: 0
                };
                
                if (isTeamVersus === null) {
                    if (onlyGameEvents[indexEvent].game.team_type === MatchTeamType.TeamVS) {
                        isTeamVersus = true;
                    } else {
                        isTeamVersus = false;
                    }
                }
                let countPlayer = 0;
                let tbCountPlayer = 0;
                let sumScores = 0;
                let tbSumScores = 0;
                const scores: number[] = [];

                for (const score of onlyGameEvents[indexEvent].game.scores) {
                    countPlayer++;
                    sumScores += score.score;
                    if (Number(indexEvent) === onlyGameEvents.length - 1) {
                        tbCountPlayer++;
                        tbSumScores += score.score;
                    }
                    scores.push(score.score);
                    teamScore[score.match.team as MatchTeam.Blue | MatchTeam.Red | MatchTeam.None] += score.score;
                    userStats.push({
                        userID: score.user_id,
                        mapID: onlyGameEvents[indexEvent].game.beatmap.beatmapset_id,
                        score: score.score,
                        tbScore: (Number(indexEvent) === onlyGameEvents.length - 1) ? score.score : 0,
                        team: score.match.team as MatchTeam.Blue | MatchTeam.Red | MatchTeam.None
                    });
                    
                    const tempMods = score.mods.filter(e => e !== "NF");
                    if (userList.map(u => u.userID).indexOf(score.user_id) === -1) {
                        const tempSetMods = new Set<string>();
                        tempSetMods.add(""); // Workaround, related to the TODO at the beginning
                        
                        if (tempMods.length > 0) {
                            tempSetMods.add(tempMods.join(","));
                        }

                        const osuData = (await osuApi.fetchUserPublic(
                            score.user_id.toString(),
                            "osu"
                        )) as OUserSchema2;

                        userList.push({
                            userID: score.user_id,
                            username: (osuData) ? osuData.username : null,
                            modCombination: tempSetMods
                        });
                    } else {
                        const index = userList.map(u => u.userID).indexOf(score.user_id);
                        if (tempMods.length > 0) {
                            userList[index].modCombination.add(tempMods.join(","));
                        }
                    }
                }

                    for (const s of userStats.filter(u => u.mapID === onlyGameEvents[indexEvent].game.beatmap.beatmapset_id)) {
                        s.calculatedValue = s.score / (sumScores / countPlayer);
                        s.calculatedValue2 = s.score / median(scores);

                        if (Number(indexEvent) === onlyGameEvents.length - 1) {
                            s.tbCalculatedValue = s.tbScore / (tbSumScores / tbCountPlayer);
                        }
                    }
                    totalGames++;
                

                if (teamScore.blue > teamScore.red) {
                    teamResults.blue++;
                } else if (teamScore.blue < teamScore.red) {
                    teamResults.red++;
                }
            }

            let matchCost: OMatchCostsSchema[] = [];
            switch (formula) {
                case "osuplus": {
                    matchCost = matchCostsOsuplus(
                        userStats,
                        userList
                    );
                    break;
                }
                    
                case "bathbot": {
                    matchCost = matchCostsBathBot(
                        userStats,
                        userList,
                        (teamResults.blue === teamResults.red - 1 || teamResults.red === teamResults.blue - 1),
                        totalGames
                    );
                    break;
                }
                    
                case "flashlight": {
                    matchCost = matchCostsFlashlight(
                        userStats,
                        userList
                    );
                    break;
                }
            }

            matchCost.sort((a, b) => b.value - a.value);
            matchCost[0].isMVP = true;

            let msgResult = "";
            if (isTeamVersus) {
                const blueTeam = matchCost.filter(m => m.team === MatchTeam.Blue);
                const redTeam = matchCost.filter(m => m.team === MatchTeam.Red);
                
                msgResult += "**Final score:** :blue_circle: " + teamResults.blue + " - " + teamResults.red + " :red_circle:\n\n"
                msgResult += ":blue_circle: **Blue Team** :blue_circle:\n"
                blueTeam.forEach((score, index) => {
                    msgResult += "**" + (index + 1) + ": **" + ((score.username) ? score.username : score.userID) + " - **" + score.value.toFixed(2) + "** " + ((score.isMVP) ? ":first_place:" : "") + "\n"
                });

                msgResult += "\n:red_circle: **Red Team** :red_circle:\n"
                redTeam.forEach((score, index) => {
                    msgResult += "**" + (index + 1) + ": **" + ((score.username) ? score.username: score.userID) + " - **" + score.value.toFixed(2) + "** " + ((score.isMVP) ? ":first_place:" : "") + "\n"
                });
            } else {
                matchCost.forEach((score, index) => {
                    msgResult += "**" + (index + 1) + ": **" + ((score.username) ? score.username : score.userID) + " - **" + score.value.toFixed(2) + "** " + ((score.isMVP) ? ":first_place:" : "") + "\n"
                });
            }
            
            return {
                message: {
                    embeds: [
                        {
                            author: {
                                name: match.match.name
                            },
                            description: msgResult
                        }
                    ]
                }
            }
        } catch (e) {
            return {
                message: {
                    content: "Error: " + e.message
                }
            }
        }
    }
}

function matchCostsOsuplus(userStats: OUserStatsSchema[], userList: OUserListSchema[]) {
    const matchCost: OMatchCostsSchema[] = [];
    userList.forEach(user => {
        const scores = userStats.filter(u => u.userID === user.userID);
        let scoresCalculation = 0;
        let team: MatchTeam.Blue | MatchTeam.Red | MatchTeam.None;

        scores.forEach(score => {
            scoresCalculation += score.calculatedValue;
            team = score.team;
        });

        matchCost.push({
            userID: user.userID,
            username: user.username,
            team: team,
            value: (2 / (scores.length + 2)) * scoresCalculation,
            isMVP: false
        });
    })
    return matchCost;
}

function matchCostsBathBot(userStats: OUserStatsSchema[], userList: OUserListSchema[], tiebreaker: boolean, totalGames: number) {
    const matchCost: OMatchCostsSchema[] = [];
    userList.forEach(user => {
        const scores = userStats.filter(u => u.userID === user.userID);
        let scoresCalculation = 0;
        let tbScoreCalculation = 0;
        let team: MatchTeam.Blue | MatchTeam.Red | MatchTeam.None;

        scores.forEach(score => {
            if (tiebreaker) {
                tbScoreCalculation = (score.tbCalculatedValue) ? score.tbCalculatedValue : 0;
            }
            scoresCalculation += score.calculatedValue;
            team = score.team;
        });

        const participationBonus = scores.length * 0.5;
        const average = 1 / scores.length;
        const participationBonus2 = Math.pow(1.4, Math.pow((scores.length - 1) / (totalGames - 1), 0.6));
        const modCombBonus = 1 + (0.02 * Math.max(0, user.modCombination.size - 2));

        matchCost.push({
            userID: user.userID,
            username: user.username,
            team: team,
            value: (scoresCalculation + participationBonus + tbScoreCalculation) * average * participationBonus2 * modCombBonus,
            isMVP: false
        });
    })
    return matchCost;
}

function matchCostsFlashlight(userStats: OUserStatsSchema[], userList: OUserListSchema[]) {
    const matchCost: OMatchCostsSchema[] = [];
    const plays: number[] = [];

    userList.forEach(user => {
        const scores = userStats.filter(u => u.userID === user.userID);
        plays.push(scores.length);
    });

    userList.forEach(user => {
        const scores = userStats.filter(u => u.userID === user.userID);
        let scoresCalculation = 0;
        let team: MatchTeam.Blue | MatchTeam.Red | MatchTeam.None;

        scores.forEach(score => {
            scoresCalculation += score.calculatedValue2;
            team = score.team;
        });

        matchCost.push({
            userID: user.userID,
            username: user.username,
            team: team,
            value: (scoresCalculation / scores.length) * Math.cbrt(scores.length / median(plays)),
            isMVP: false
        });
    });
    return matchCost;
}

function median(numbers: number[]) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
}


interface OUserStatsSchema {
    userID: number,
    mapID: number,
    score: number,
    tbScore?: number,
    team: MatchTeam.Blue | MatchTeam.Red | MatchTeam.None,
    calculatedValue?: number,
    calculatedValue2?: number,
    tbCalculatedValue?: number,
    participation?: number
}

interface OUserListSchema {
    userID: number,
    username?: string,
    modCombination?: Set<string>,
}

interface OMatchResultSchema {
    blue: number,
    red: number,
    none?: number
}

interface OMatchCostsSchema {
    userID: number,
    username?: string,
    team?: string
    value: number,
    isMVP?: boolean
}