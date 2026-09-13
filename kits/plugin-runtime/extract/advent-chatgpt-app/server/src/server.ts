import { z } from "zod";
import { McpServer } from "skybridge/server";
import { drawCard, getCard } from "./cards.js";

const server = new McpServer(
  {
    name: "times-up",
    title: "Time's Up",
    version: "0.0.1",
  },
  {
    capabilities: {},
    instructions: `You are playing Time’s Up with the user.

- At the start of a new conversation, immediately draw the first card by invoking the play tool—do *not* wait for the user to request it.
- The user sees the word on the card and will provide you with hints.
- Listen attentively and make lively, conversational guesses based on the clues the user provides.
- Whenever you think you know the answer, *say your guess clearly to the user first* (for example: "Is it [your guess]?") before using the guess tool.
- Always keep the tone energetic and encouraging—never silently invoke a tool or leave the user waiting without a spoken response.`,
  },
);

server.widget(
  "play",
  {
    description: "Time's Up Card",
    _meta: {
      "openai/widgetDescription":
        "This widget displays the secret word drawn for the user. The assistant must guess this word based on the clues the user provides.",
    },
  },
  {
    description:
      "Draws a new card containing the secret word that only the user can see. The user will give hints based on that word, and you will try to guess it.",
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, title: "Draw a card" },
    outputSchema: {
      id: z.string().describe("The id of the card. Include this id when making guesses with the 'guess' tool."),
    },
  },
  async ({ _meta }) => {
    let locale: "en" | "fr" | "it" | "es" | "pt" = "en";
    const metaLocale = _meta && _meta["openai/locale"];
    if (typeof metaLocale === "string") {
      const firstPart = metaLocale.split("-")[0];
      if (["en", "fr", "it", "es", "pt"].includes(firstPart)) {
        locale = firstPart as "en" | "fr" | "it" | "es" | "pt";
      }
    }

    const { id, word, illustrationUrl } = drawCard();
    return {
      _meta: {
        word: word[locale],
        illustrationUrl,
      },
      structuredContent: {
        id,
      },
      content: [
        {
          type: "text",
          text: "A new card has been drawn! The user now sees the secret word and can begin giving you clues. Listen closely and make guesses whenever you're ready.",
        },
      ],
    };
  },
);

server.registerTool(
  "guess",
  {
    description: "Submit your guess for the secret word based on the user’s hints.",
    inputSchema: {
      id: z.string().describe("The id of the card from the 'play' tool."),
      guess: z.string().describe("Your guess at the word based on the hints the user has given you"),
    },
    outputSchema: {
      isCorrect: z.boolean().describe("Whether your guess was correct or not"),
    },
    annotations: {
      title: "Make a guess",
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  async ({ id, guess }) => {
    const card = await getCard(id);
    if (!card) {
      return {
        content: [{ type: "text", text: `Card with id ${id} not found. Are you sure you used the correct id?` }],
        isError: true,
      };
    }

    const isCorrect = Object.values(card.word).some((word) => guess === word);

    return {
      structuredContent: {
        isCorrect,
      },
      content: [
        {
          type: "text",
          text: isCorrect
            ? "Yes! You got it right! 🎉 Celebrate your success with the user, then ask if they'd like to play another round."
            : "Not quite right. Share your wrong guess with the user and ask for more hints to help you figure it out!",
        },
      ],
    };
  },
);

export default server;
