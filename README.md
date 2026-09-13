# Sherlock Holes

Build a full-stack learning application based on the Feynman Technique (learning by teaching). The app operates in three core, sequential modes: Student Mode (Teach Sherlock!), Mid-Session Q&A, and Teacher Mode (Learn from Sherlock!).

1. SETUP & THE CORE DATA

- The student lands on a dashboard that has multiple notebooks (each notebook has a number of chat bot sessions the user can control) specified for different concepts, courses, or topics. They define what course/concept/topic material they want to teach for each particular chat session within a notebook. When a student clicks on a notebook on their dashboard, they have the option to create a new chat bot session or click on an existing one, or delete one (requires a confirmation button). 

- If the user selects a new chat bot session, the user has the option to name the chat session based on what topic they want to work on before moving on. 

- First, if the student has no clue how to explain a concept, topic, or their notes (or etc.), they switch to the Learn from Sherlock! Session, where they engage in a comprehensive explanation of their notes (if the user inputs them) or a concept/topic. This is spoken by the AI chat bot using the ElevenLabs add-on.

- Second, they provide two ways to input data: Option A allows uploading text/notes. Option B provides a form where they type out a list of "Key Concepts" they intend to cover. Either option is inputted into this particular chat bot session. The bot then uses this data to create initial questions that should be answered during the blurt session. If not answered, these questions should be asked during the Mid-Session Q&A.

- Third, the user blurts out an attempted comprehensive explanation of the concept, its parameters, special cases, and important details about something. The user can pick a specific amount of time, up to 5 minutes (proven by SOURCE FOR FEYNMAN TECHNIQUE TIME LIMIT) to speak; after you finish your amount of time speaking, it will ask you questions, and the user can only ask follow-up questions after the session ends (mirrors current understanding of material to fullest). The pause is self initiated by the user, though there is a timer with warning colors (yellow when 30 secs left, red when time is done). If the user finishes their explanation early or once the timer ends, they can skip to the Mid-Session Q&A part of the Teach Sherlock! session OR directly to Learn from Sherlock! session, and the user either 1. answers any of the bot’s questions regarding their explanation during the Mid-Session Q&A or 2. engages in the Learn from Sherlock Session!

- While the blurt session is occurring, there is an animated expression that glows Green, Yellow, and Red. Green is for an accurate, elaborative explanation of a concept with no missed definitions, concepts, or conditions; The animated expression for green is a smile with a thumbs-up. Yellow is for a need for more details, more cases, vague responses present, and forgetting a definition or condition of a definition. The animated expression for yellow is a confused face with a question mark. Red is for a wrong explanation of a concept, definition, or condition. The animated expression for red is a shocked face with a red exclamation mark. The following details when each expression will be used:

Neutral - Constant, regular condition ; present in both blurt session and Q&A ; when bot is asking questions or the user is still defining something, they are neutral

Green - Smile face with a thumbs up - present when the student explains a concept or topic in depth with no missed details, or (during the Mid-Session Q&A) the student answers the bot’s question correctly

Yellow - Confused face with a question mark - student misses some information during an explanation or definition, or does not fully explain the topic accurately to a bot’s question

Red - Shocked face with an exclamation mark - shows on the screen when the user says inaccurate information during the blurt session or if the user answers incorrectly to a bot’s question

ALL - There should be a smooth transition between each expression

- Also during this blurt session, the bot is actively creating questions to ask during the mid-session Q&A, based on the student’s explanation. The questions should focus on areas where the student has not gone into detail or missed something related to the key concept.

- Fourth, after the blurt session is completed, the Mid-Session Q&A session starts and the AI asks questions based on the blurt session and the notes, and specifically targets the gaps, or “holes,” in the student’s explanation. The AI should have a neutral face while asking the question, and have a positive expression (green) if the student answers it correctly with elaboration and accuracy, a confused expression (yellow) if the student may need to elaborate more or is forgetting a definition/condition, and a shocked expression (red) if the student answers incorrectly. See below for further steps from each expression:

With a positive (green) expression, the bot asks the next question as it is satisfied

With a confused (yellow) expression, the bot asks a follow-up question to elaborate more on something they mentioned or explain more

With a shocked (red) expression, the bot asks related questions (but does not give the answer) that helps the student think critically about the actual solution. The concept that the student answers incorrectly is transferred to the feedback session for critical learning on that concept.

- Fifth, after the Mid-Session Q&A, the student receives a summary of what concepts/topics they covered, what questions the bot still had after the initial teaching, and what they missed/misunderstood in their explanation. It also gives the amount of time the student spoke for, as well as how many examples the students gave for concepts. It lists the amount of time spent on each subtopic (reference only the data given to the bot by the student). 

- Sixth, after the user reviews the session summary, the user has the option to add what concepts or explanations the user did not cover or misunderstood to the Learn from Sherlock! knowledge data. Then the user can either move to Learn from Sherlock! session, create a new Teach Sherlock! session, or exit the session and return to the user dashboard.

- Seventh, in the Learn from Sherlock! session, the student can learn from the AI chat bot in regards to the details within their notes or from a concept/topic that the student wants to know more about through interactive practice. 

- Store these concepts/notes in the database connected to the current session. Each feedback session summary will be saved to that specific notebook session’s data.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sherlock-holes.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0f3674e8-b110-4a97-a1d7-0b2868a0beef).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
