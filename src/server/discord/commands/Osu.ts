import { Command, CommandReturn } from "../models/ICommands";
import { osuApiV2 as osuApi, OUserSchema2 } from "../../OsuApiV2";
import { User } from "../../models/User";

export default <Command>{
    commandEnum: "OSU",
    defaultPermission: true,
    name: "osu",
    description: "Displays information about an player",
    options: [
        {
            name: "user",
            description: "osu! user id or username",
            type: "STRING",
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
            name: "discord",
            description: "Choose a linked discord user",
            type: "USER",
            required: false
        }
    ],
    async call({ interaction }): Promise<CommandReturn> {
        try {
            const guildMember = interaction.options.getUser("discord", false) || interaction.member.user;
            const userDb = await User.findOne({ "discord.userId": guildMember.id });
            const user = interaction.options.getString("user", false) || (userDb ? userDb.osu.userId.toString() : null);
            const gamemode = (interaction.options.getString("gamemode", false) || (userDb ? userDb.osu.playmode : "osu")) as "osu" | "mania" | "fruits" | "taiko";

            if (!['osu', 'fruits', 'taiko', 'mania'].includes(gamemode)) return;
            
            if (!userDb) {
                return {
                    message: {
                        content: "The user doesn't have any osu account linked"
                    }
                }
            }

            const ret = (await osuApi.fetchUserPublic(
                user,
                gamemode
            )) as OUserSchema2;

            return {
                message: {
                    embeds: [
                        {
                            author: {
                                name: ret.username,
                                url: "https://osu.ppy.sh/users/" + ret.id,
                                icon_url: `https://osu.ppy.sh/images/flags/${ret.country.code}.png`
                            },
                            thumbnail: {
                                url: ret.avatar_url
                            },
                            description: `
                                         ▸ **Rank:** #${ret.statistics.global_rank || 0} (${ret.country.name} #${ret.statistics.rank.country || 0})
                                         ▸ **Level:** ${ret.statistics.level.current} (${ret.statistics.level.progress}%)
                                         ▸ **Total PP:** ${ret.statistics.pp}
                                         ▸ **Accuracy:** ${ret.statistics.hit_accuracy.toFixed(2)}
                                         ▸ **Playcount:** ${ret.statistics.play_count} (${secondsToHours(ret.statistics.play_time)} hrs)
                                         `,
                            footer: {
                                text: `Previous usernames: ${ret.previous_usernames.join(", ") || 'The user had no other user names'}`,
                                icon_url: `https://raw.githubusercontent.com/ppy/osu-wiki/master/wiki/shared/mode/${(gamemode === "fruits") ? "catch" : gamemode}.png`
                            }
                        }
                    ]
                }
            }
        } catch (e) {
            return {
                message: {
                    content: "The user doesn't exist"
                }
            }
        }
    },
};

function secondsToHours(duration: number) {
    return Math.trunc(duration / 3600);
}