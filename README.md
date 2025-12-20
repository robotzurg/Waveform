# Waveform
Waveform is a music reviewing discord bot, designed to help facilitate music and album discussions in servers, with a variety of features attached to Spotify, Last.FM, and Discord. It is planned to tie into the work in progress Waveform Reviews site.

## Invite Link
You can try out the bot in your own discord server with this invite link: https://discord.com/oauth2/authorize?client_id=828651073136361472&permissions=534723816512&scope=applications.commands%20bot


## Running bot with docker (WIP)

- Create a directory and add a `docker-compose.yaml` file with the following contents:

```yaml
services:
  discord-bot:
    image: discord-bot:latest  # will become ghrc
    container_name: waveform
    restart: unless-stopped
    environment:
      DISCORD_TOKEN: token # add token here
    volumes:
      - ./data:/app/data

```

- Then create a folder where the docker-compose file is located named `data` and add the DB files to it.

- Run the container with `docker compose up -d`