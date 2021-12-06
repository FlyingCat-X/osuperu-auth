import { Command, CommandReturn } from "../models/ICommands";
import { OMatchesSchema, osuApiV2 as osuApi, OUserSchema2 } from "../../OsuApiV2";

/**
 * TODO:
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
                if (match.events[0].detail.type !== "match-created") {
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
                    } while (match.events[0].detail.type !== "match-created")
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

            for (const event of match.events) {
                const teamScore: OMatchResultSchema = {
                    blue: 0,
                    red: 0,
                    none: 0
                };
                if (Object.prototype.hasOwnProperty.call(event, "game")) {
                    if (isTeamVersus === null) {
                        if (event.game.team_type === "team-vs") {
                            isTeamVersus = true;
                        } else {
                            isTeamVersus = false;
                        }
                    }
                    let countPlayer = 0;
                    let sumScores = 0;
                    const scores: number[] = [];

                    for (const score of event.game.scores) {
                        countPlayer++;
                        sumScores += score.score;
                        scores.push(score.score);
                        teamScore[score.match.team as "blue" | "red" | "none"] += score.score;
                        userStats.push({
                            userID: score.user_id,
                            mapID: event.game.beatmap.beatmapset_id,
                            score: score.score,
                            team: score.match.team as "blue" | "red" | "none"
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

                    for (const s of userStats.filter(u => u.mapID === event.game.beatmap.beatmapset_id)) {
                        s.calculatedValue = s.score / (sumScores / countPlayer);
                        s.calculatedValue2 = s.score / median(scores);
                    }
                    totalGames++;
                }

                if (teamScore.blue > teamScore.red) {
                    teamResults.blue++;
                } else if (teamScore.blue < teamScore.red) {
                    teamResults.red++;
                }
            }

            let matchCost: OMatchCostsSchema[] = [];
            switch (formula) {
                case "osuplus": {
                    matchCost = matchCostsOsuplus(userStats, userList);
                    break;
                }
                    
                case "bathbot": {
                    matchCost = matchCostsBathBot(userStats, userList, totalGames);
                    break;
                }
                    
                case "flashlight": {
                    matchCost = matchCostsFlashlight(userStats, userList);
                    break;
                }
            }

            matchCost.sort((a, b) => b.value - a.value);
            matchCost[0].isMVP = true;

            let msgResult = "";
            if (isTeamVersus) {
                const blueTeam = matchCost.filter(m => m.team === "blue");
                const redTeam = matchCost.filter(m => m.team === "red");
                
                msgResult += "**Final score:** :blue_circle: " + teamResults.blue + " - " + teamResults.red + " :red_circle:\n\n"
                msgResult += ":blue_circle: **Blue Team** :blue_circle:\n"
                blueTeam.forEach((score, index) => {
                    msgResult += "**" + index + ": **" + ((score.username) ? score.username : score.userID) + " - **" + score.value.toFixed(2) + "** " + ((score.isMVP) ? ":first_place:" : "") + "\n"
                });

                msgResult += "\n:red_circle: **Red Team** :red_circle:\n"
                redTeam.forEach((score, index) => {
                    msgResult += "**" + index + ": **" + ((score.username) ? score.username: score.userID) + " - **" + score.value.toFixed(2) + "** " + ((score.isMVP) ? ":first_place:" : "") + "\n"
                });
            } else {
                matchCost.forEach((score, index) => {
                    msgResult += "**" + index + ": **" + ((score.username) ? score.username : score.userID) + " - **" + score.value.toFixed(2) + "** " + ((score.isMVP) ? ":first_place:" : "") + "\n"
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
            console.log(e);
        }
    }
}

function matchCostsOsuplus(userStats: OUserStatsSchema[], userList: OUserListSchema[]) {
    const matchCost: OMatchCostsSchema[] = [];
    userList.forEach(user => {
        const scores = userStats.filter(u => u.userID === user.userID);
        let scoresCalculation = 0;
        let team: "blue" | "red" | "none";

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

function matchCostsBathBot(userStats: OUserStatsSchema[], userList: OUserListSchema[], totalGames: number) {
    const matchCost: OMatchCostsSchema[] = [];
    userList.forEach(user => {
        const scores = userStats.filter(u => u.userID === user.userID);
        let scoresCalculation = 0;
        let team: "blue" | "red" | "none";

        scores.forEach(score => {
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
            value: (scoresCalculation + participationBonus) * average * participationBonus2 * modCombBonus,
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
        let team: "blue" | "red" | "none";

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
    team: "blue" | "red" | "none",
    calculatedValue?: number,
    calculatedValue2?: number,
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