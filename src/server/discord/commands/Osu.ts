import { Command, CommandReturn } from "../models/ICommands";
import { osuApiV2 as osuApi, OUserSchema2 } from "../../OsuApiV2";

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
            required: true
        }
    ],
    async call({ interaction }): Promise<CommandReturn> {
        const user = interaction.options.getString("user", true);

        try {
            const ret = (await osuApi.fetchUserPublic(
                user,
                "osu"
            )) as OUserSchema2;
            
            return {
                message: {
                    embeds: [
                        {
                            author: {
                                name: ret.username,
                                url: "https://osu.ppy.sh/users/" + user,
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
                                text: `Previous usernames: ${ret.previous_usernames.join(", ") || 'The user had no other user names'}`
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