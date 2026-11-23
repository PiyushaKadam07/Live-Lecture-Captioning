import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";
import { WebSpeechRecognizer } from "../src/recognizers/webSpeech";
import { FakeSpeechRecognition } from "./fakeSpeech";

const factory = (lang: string) => new WebSpeechRecognizer(lang, FakeSpeechRecognition);
const fake = () => FakeSpeechRecognition.instances[FakeSpeechRecognition.instances.length - 1];

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    FakeSpeechRecognition.instances = [];
    // These tests drive the browser (Web Speech API) engine.
    localStorage.setItem("lecture-captions:settings", JSON.stringify({ engine: "browser" }));
  });

  it("explains which browsers work when speech recognition is missing", () => {
    render(<App supported={false} createRecognizer={factory} />);
    expect(screen.getByRole("alert")).toHaveTextContent("needs Chrome or Edge");
    expect(screen.getByRole("button", { name: "Start captions" })).toBeDisabled();
  });

  it("shows the privacy notice once, then captions speech into the transcript", async () => {
    const user = userEvent.setup();
    render(<App supported createRecognizer={factory} />);

    await user.click(screen.getByRole("button", { name: "Start captions" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("sends microphone audio");
    await user.click(screen.getByRole("button", { name: "I understand, start captions" }));
    expect(screen.getByRole("status")).toHaveTextContent("Listening");

    act(() => fake().emit([{ text: "the mitochondria", isFinal: false }]));
    const captions = screen.getByLabelText("Live captions");
    expect(within(captions).getByText(/the mitochondria/)).toHaveClass("seg-interim");

    act(() => fake().emit([{ text: "The mitochondria makes energy.", isFinal: true }]));
    expect(within(captions).getByText(/makes energy/)).toHaveClass("seg-final");
    expect(screen.getByRole("list")).toHaveTextContent("The mitochondria makes energy.");
    expect(screen.getByText("1 line")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop captions" }));
    expect(screen.getByRole("status")).toHaveTextContent("Not listening");

    // The notice doesn't come back once accepted.
    await user.click(screen.getByRole("button", { name: "Start captions" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("searches the transcript and keeps it after a reload", async () => {
    const user = userEvent.setup();
    localStorage.setItem("lecture-captions:settings", JSON.stringify({ engine: "browser", privacyAcknowledged: true }));
    const { unmount } = render(<App supported createRecognizer={factory} />);
    await user.click(screen.getByRole("button", { name: "Start captions" }));
    act(() => fake().emit([{ text: "Eigenvalues are scalars.", isFinal: true }]));
    act(() => fake().emit([{ text: "Matrices can be diagonalized.", isFinal: true }], 0));
    unmount();

    render(<App supported createRecognizer={factory} />);
    expect(screen.getByText("2 lines")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "eigen");
    expect(screen.getByText("1 match")).toBeInTheDocument();
    expect(screen.getByRole("list")).not.toHaveTextContent("Matrices");
  });

  it("shows a clear message when the microphone is blocked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("lecture-captions:settings", JSON.stringify({ engine: "browser", privacyAcknowledged: true }));
    render(<App supported createRecognizer={factory} />);
    await user.click(screen.getByRole("button", { name: "Start captions" }));
    act(() => fake().onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access was blocked");
  });
});
