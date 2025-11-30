import { Result, Serialized } from "@alvarobarrerotanarro/autothread-types"

declare export default Record<string, (params: any) => Promise<Result<Serialized>> | Result<Serialized>>;