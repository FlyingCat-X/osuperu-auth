import axios from 'axios';
import { DateTime } from 'luxon';
import { App } from './App';

export interface CodeExchangeSchema {
    token_type: "Bearer",
    expires_in: number,
    access_token: string,
    refresh_token?: string,
}

export interface OUserGroupSchema {
    id: number,
    identifier: string,
    name: string,
    short_name: string,
    description: string,
    colour: string
}

export interface OUserSchema {
    country_code: string,
    avatar_url: string,
    username: string,
    playmode: "osu" | "mania" | "fruits" | "taiko",
    groups: OUserGroupSchema[],
    ranked_beatmapset_count: number,
    is_restricted: boolean
}

export interface OUserSchema2 {
    avatar_url: string,
    id: number,
    username: string,
    playmode: "osu" | "mania" | "fruits" | "taiko",
    country: OUserCountrySchema,
    statistics: OUserStatisticsSchema,
    previous_usernames: string[]
}

export interface OUserCountrySchema {
    code: string,
    name: string,
}

export interface OUserStatisticsSchema {
    level: OUserLevelSchema,
    global_rank: number,
    pp: number,
    hit_accuracy: number,
    play_count: number,
    play_time: number,
    rank: OUserRankSchema,
}

export interface OUserLevelSchema {
    current: number,
    progress: number,
}

export interface OUserRankSchema {
    country: string,
}

export class osuApiV2 {

    static async fetchUser(user?: string, accessToken?: string, gameMode?: string): Promise<unknown> {
        return await this.request({
            endpoint: `${user ? `/users/${user}` : "/me"}${gameMode ? `/${gameMode}` : ""}`,
            accessToken,
        });
    }
  
    static async request({endpoint, accessToken}: { endpoint: string; accessToken?: string }): Promise<unknown> {
        const response = await axios(endpoint, {
            baseURL: "https://osu.ppy.sh/api/v2",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        
        return response.data;
    }

    static async refreshAccessToken(refresh_token: string): Promise<unknown> {
        return (await axios({
            method: 'post',
            url: "https://osu.ppy.sh/oauth/token",
            data: {
                grant_type: 'refresh_token',
                refresh_token,
                client_id: App.instance.config.osu.clientId,
                client_secret: App.instance.config.osu.clientSecret,
            }
        })).data;
    }

    static async refreshClientCredential(): Promise<void> {
        if(Math.abs(App.instance.clientCredential.lastFetched.diffNow("days").days) < 0.95) return;
        const response = (await axios.post<CodeExchangeSchema>("https://osu.ppy.sh/oauth/token", {
            grant_type: 'client_credentials',
            scope: "public",
            client_id: App.instance.config.osu.clientId,
            client_secret: App.instance.config.osu.clientSecret,
        })).data;

        App.instance.clientCredential = {
            token: response.access_token,
            lastFetched: DateTime.now().setZone(App.instance.config.misc.timezone),
        };
    }

    static async fetchUserPublic(userid: string, gamemode: "osu" | "mania" | "fruits" | "taiko"): Promise<unknown> {
        await this.refreshClientCredential();
        return this.request({
            endpoint: `/users/${userid}/${gamemode}${(isNumeric(userid) ? "" : "?key=username")}`,
            accessToken: App.instance.clientCredential.token,
        });
    }
}

function isNumeric(val: string): boolean {
    return ((val != null) && (val !== '') && !isNaN(Number(val.toString())));
}