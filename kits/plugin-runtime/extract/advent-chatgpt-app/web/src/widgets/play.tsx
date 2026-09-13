import "@/index.css";

import {
  mountWidget,
  useCallTool,
  useDisplayMode,
  useLocale,
  useSendFollowUpMessage,
  useToolInfo,
} from "skybridge/web";
import { LoadingIndicator } from "@openai/apps-sdk-ui/components/Indicator";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { useEffect, useState } from "react";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { FormattedMessage, IntlProvider } from "react-intl";

import enUS from "./locales/en-US.json";
import frFR from "./locales/fr-FR.json";
import itIT from "./locales/it-IT.json";
import esES from "./locales/es-ES.json";
import ptBR from "./locales/pt-BR.json";

function PlayWidget() {
  const locale = useLocale() ?? "en-US";
  const [visible, setVisible] = useState(false);
  const [card, setCard] = useState<{ word: string; illustrationUrl: string }>();
  const [, setDisplayMode] = useDisplayMode();
  const { responseMetadata } = useToolInfo() as unknown as {
    responseMetadata: { word: string; illustrationUrl: string } | null;
  };

  useEffect(() => {
    if (responseMetadata) {
      setCard(responseMetadata);
    }
  }, [responseMetadata]);

  const { callTool: play, isPending } = useCallTool<
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {},
    // @ts-expect-error - TODO: fix this
    { structuredContent: { id: string }; meta: { word: string; illustrationUrl: string } }
  >("play");
  const sendFollowUpMessage = useSendFollowUpMessage();

  const messages: Record<string, Record<string, string>> = {
    "en-US": enUS,
    "fr-FR": frFR,
    "it-IT": itIT,
    "es-ES": esES,
    "pt-BR": ptBR,
  };

  return (
    <IntlProvider locale={locale} messages={messages[locale] ?? messages["en-US"]}>
      <div className="flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="font-bold text-2xl">Time's Up</h1>
        <i>ChatGPT Edition</i>
        <div className="flex flex-col items-center w-fit p-4 gap-4 rounded-xl border border-white/20 shadow-lg bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100">
          <Badge size="sm" color="info" variant={visible ? "outline" : "solid"}>
            Time's Up
          </Badge>
          {card ? (
            visible ? (
              <img
                src={card.illustrationUrl}
                alt={card.word}
                className={`w-20 h-20 transition-all duration-800 ${visible ? "opacity-100" : "opacity-0 blur-3xl"}`}
              />
            ) : (
              <div className="w-20 h-20 flex items-center justify-center text-4xl font-bold">?</div>
            )
          ) : (
            <LoadingIndicator size={16} className="m-8" />
          )}
          <Badge
            size="lg"
            color="info"
            variant="solid"
            className={`capitalize transition-all duration-800 ${visible ? "" : "blur-3xl"}`}
          >
            {card?.word}
          </Badge>
        </div>
        {visible ? (
          <Button
            color="secondary"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setCard(undefined);
              play(
                {},
                {
                  onSuccess: (data) => {
                    setCard(data.meta);
                    sendFollowUpMessage(
                      `The user has a decided to draw another card. The id of this new card is: ${data.structuredContent.id}. Don't show this id to the user. Use this new id when making guesses with the 'guess' tool.`,
                    );
                  },
                },
              );
            }}
          >
            <FormattedMessage id="drawAnotherCard" />
          </Button>
        ) : (
          <Button
            color="primary"
            disabled={!card}
            onClick={() => {
              setDisplayMode("pip");
              setVisible(true);
            }}
          >
            <FormattedMessage id="newGame" />
          </Button>
        )}
      </div>
    </IntlProvider>
  );
}

export default PlayWidget;

mountWidget(<PlayWidget />);
