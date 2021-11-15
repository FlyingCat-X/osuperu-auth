import * as ojsama from "ojsama";
import * as booba from "booba";
import axios from "axios";
import { OBoobaComputeSchema, OCalculationSchema, OUserRecentSchema } from "./OsuApiV2";

export class osuUtil {
    static async calculatePP(recent: OUserRecentSchema): Promise<OCalculationSchema> {
        const osuFile = await axios.get(`https://osu.ppy.sh/osu/${recent.beatmap.id}`, { responseType: 'blob' });
        
        const parser = new ojsama.parser().feed(osuFile.data.toString());
        const parsedBeatmap = parser.map;

        const boobaCalc = new booba.std_ppv2().setPerformance(recent);
        const recentPP = await boobaCalc.compute() as OBoobaComputeSchema;
        const fcPP = await boobaCalc.compute(true) as OBoobaComputeSchema;

        if (recent.rank === "F") {
            const totalHits = recent.statistics.count_50 + recent.statistics.count_100 + recent.statistics.count_300 + recent.statistics.count_miss;
            const generalCount = Number(parsedBeatmap.objects.length);
            const beatmapHitObjects = [];

            parsedBeatmap.objects.forEach(singleObject => beatmapHitObjects.push(Number(singleObject.time)));

            const hitTiming = parseInt(beatmapHitObjects[generalCount - 1]) - parseInt(beatmapHitObjects[0]);
            const hitPoint = parseInt(beatmapHitObjects[totalHits - 1]) - parseInt(beatmapHitObjects[0]);

            const mapCompletion = (hitPoint / hitTiming) * 100;
            
            return {
                mapCompletion: mapCompletion,
                recentPP: recentPP,
                fcPP: fcPP
            };
        } else {
            return {
                mapCompletion: 100,
                recentPP: recentPP,
                fcPP: fcPP
            }
        }
    }
}