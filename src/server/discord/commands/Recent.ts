import { Command, CommandReturn } from "../models/ICommands";
import { OBeatmapSchema, OCalculationSchema, osuApiV2 as osuApi, OUserRecentSchema, OUserSchema2 } from "../../OsuApiV2";
import { osuUtil } from "../../OsuUtil";
import { User } from "../../models/User";

export default <Command>{
    commandEnum: "RS",
    defaultPermission: true,
    name: "recent",
    description: "Gets a recent play from a player",
    options: [
        {
            name: "user",
            description: "osu! user id or username",
            type: "STRING",
            required: false
        },
        {
            name: "discord",
            description: "Choose a linked discord user",
            type: "USER",
            required: false
        },
        {
            name: "gamemode",
            description: "Choose a osu! gamemode by clicking here",
            type: "STRING",
            choices: [
                {
                    "name": "osu!standard",
                    "value": "osu"
                },
                {
                    "name": "osu!taiko",
                    "value": "taiko"
                },
                {
                    "name": "osu!catch",
                    "value": "fruits"
                },
                {
                    "name": "osu!mania",
                    "value": "mania"
                }
            ],
            required: false
        },
        {
            name: "offset",
            description: "Get specific play number from recents",
            type: "INTEGER",
            required: false
        },
        {
            name: "fails",
            description: "Includes failed plays",
            type: "STRING",
            choices: [
                {
                    "name": "false",
                    "value": "0"
                },
                {
                    "name": "true",
                    "value": "1"
                }
            ],
            required: false
        }
    ],
    async call({ interaction }): Promise<CommandReturn> {
        try {
            const guildMember = interaction.options.getUser("discord", false) || interaction.member.user;
            const userDb = await User.findOne({ "discord.userId": guildMember.id });
            const user = interaction.options.getString("user", false) || (userDb ? userDb.osu.userId.toString() : null);
            const gamemode = (interaction.options.getString("gamemode", false) || "osu") as "osu" | "mania" | "fruits" | "taiko";
            const offset = interaction.options.getInteger("offset", false) || 0;
            const includeFails = (interaction.options.getString("fails", false) || "1") as "0" | "1";
        
            if (!['osu', 'fruits', 'taiko', 'mania'].includes(gamemode) || !["0", "1"].includes(includeFails)) return;

            if (!userDb) {
                return {
                    message: {
                        content: "The user doesn't have any osu account linked"
                    }
                }
            }
            
            const usr = (await osuApi.fetchUserPublic(
                user,
                gamemode
            )) as OUserSchema2;
            
            const ret = (await osuApi.fetchUserRecentPlays(
                usr.id,
                gamemode,
                1,
                offset,
                includeFails
            ))[0] as OUserRecentSchema;

            if (ret == null) {
                return {
                    message: {
                        content: "`" + usr.username + "` has no recent plays for `" + gamemode + "`"
                    }
                }
            }

            const bmp = (await osuApi.fetchBeatmap(
                ret.beatmap.id
            )) as OBeatmapSchema;

            const pp = (await osuUtil.calculatePP(
                ret,
                gamemode
            )) as OCalculationSchema;

            return {
                message: {
                    embeds: [
                        {
                            author: {
                                name: `${ret.beatmapset.artist} - ${ret.beatmapset.title} [${ret.beatmap.version}] ${(ret.mods.length > 0) ? "+" + ret.mods.join("") : ""} [${(gamemode === "osu") ? pp.convertedStars.toFixed(2) : ret.beatmap.difficulty_rating}★]`,
                                url: `https://osu.ppy.sh/b/${ret.beatmap.id}`,
                                icon_url: usr.avatar_url
                            },
                            thumbnail: {
                                url: `https://b.ppy.sh/thumb/${ret.beatmap.beatmapset_id}.jpg`
                            },
                            description: `
                                         ▸ **${pp.recentPP.total.toFixed(2)}pp** (${pp.fcPP.total.toFixed(2)}pp for ${pp.fcPP.computed_accuracy.toFixed(2)}% FC) ▸ ${pp.recentPP.computed_accuracy.toFixed(2)}%
                                         ▸ ${numberWithCommas(ret.score)} ▸ x${ret.max_combo}/${bmp.max_combo} ▸ [${ret.statistics.count_300}/${ret.statistics.count_100}/${ret.statistics.count_50}/${ret.statistics.count_miss}]
                                         ▸ **Map completion:** ${pp.mapCompletion.toFixed(2)}%
                                         `,
                            footer: {
                                text: `Played ${timeConversion(new Date().valueOf() - new Date(ret.created_at).valueOf())} ago`,
                                icon_url: `https://raw.githubusercontent.com/ppy/osu-wiki/master/wiki/shared/mode/${(gamemode === "fruits") ? "catch" : gamemode}.png`
                            }
                        }
                    ]
                }
            };
        } catch (e) {
            return {
                message: {
                    content: "Error: " + e.message
                }
            }
        }
    },
};

function numberWithCommas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

function timeConversion(duration: number) {
    const portions: string[] = [];
  
    const msInHour = 1000 * 60 * 60;
    const hours = Math.trunc(duration / msInHour);
    if (hours > 0) {
      portions.push(hours + ' hours');
      duration = duration - (hours * msInHour);
    }
  
    const msInMinute = 1000 * 60;
    const minutes = Math.trunc(duration / msInMinute);
    if (minutes > 0) {
      portions.push(minutes + ' minutes');
      duration = duration - (minutes * msInMinute);
    }
  
    const seconds = Math.trunc(duration / 1000);
    if (seconds > 0) {
      portions.push(seconds + ' seconds');
    }
  
    return portions.join(' ');
  }