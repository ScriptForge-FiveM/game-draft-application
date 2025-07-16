export interface DiscordGuild {
  id: string
  name: string
  icon?: string
}

export interface DiscordUser {
  id: string
  username: string
  discriminator: string
  avatar?: string
  guilds?: DiscordGuild[]
}

export class DiscordAPI {
  private static readonly DISCORD_API_BASE = 'https://discord.com/api/v10'
  private static readonly TARGET_GUILD_ID = '1327288155514208256' // Replace with your actual server ID

  static async getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
    try {
      const response = await fetch(`${this.DISCORD_API_BASE}/users/@me/guilds`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching user guilds:', error)
      throw error
    }
  }

  static async getUserInfo(accessToken: string): Promise<DiscordUser> {
    try {
      console.log('🌐 Making Discord API request for user info...')
      const response = await fetch(`${this.DISCORD_API_BASE}/users/@me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('📡 Discord API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Discord API error response:', errorText)
        throw new Error(`Discord API error: ${response.status}`)
      }

      const userData = await response.json()
      console.log('✅ Discord user data received:', userData)
      return userData
    } catch (error) {
      console.error('Error fetching user info:', error)
      throw error
    }
  }

  static isUserInTargetServer(guilds: DiscordGuild[]): boolean {
    return guilds.some(guild => guild.id === this.TARGET_GUILD_ID)
  }

  static getTargetGuildId(): string {
    return this.TARGET_GUILD_ID
  }

  static getInviteLink(): string {
    return 'https://discord.gg/QMZKJ9ar7t'
  }
}