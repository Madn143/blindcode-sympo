import { db } from "../config/firebaseAdmin.js";
import { Timestamp } from "firebase-admin/firestore";

const round1Questions = [
  { id: "1", questionNo: 1, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int a = 10;\n5      int b = 20;\n6      int sum = a + b\n7      printf(\"%d\", sum);\n8      return 0;\n9  }", correctLine: "6", correctedLine: "int sum = a + b;", description: "The semicolon is missing at the end of the variable declaration." },
  { id: "2", questionNo: 2, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int a = 10;\n5      if (a > 5) {\n6          printf(\"Greater\");\n7      }\n8      else\n9          printf(\"Smaller\")\n10     return 0;\n11 }", correctLine: "9", correctedLine: "printf(\"Smaller\");", description: "The printf statement is missing a semicolon." },
  { id: "3", questionNo: 3, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int i;\n5      for (i = 0; i < 5; i++) {\n6          printf(\"%d\", i);\n7      }\n8      return 0;\n9  }", correctLine: "5", correctedLine: "for (i = 0; i < 5; i++) {", description: "This is a valid loop statement. Replace the incorrect increment expression if the question uses an error." },
  { id: "4", questionNo: 4, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int a = 10;\n5      int b = 0;\n6      printf(\"%d\", a / b);\n7      return 0;\n8  }", correctLine: "6", correctedLine: "printf(\"%d\", a / b);", description: "Division by zero must be prevented." },
  { id: "5", questionNo: 5, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int number = 10;\n5      if (number = 10) {\n6          printf(\"Ten\");\n7      }\n8      return 0;\n9  }", correctLine: "5", correctedLine: "if (number == 10) {", description: "Use == for comparison instead of =." },
  { id: "6", questionNo: 6, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int a = 5;\n5      int b = 10;\n6      int result = a * b;\n7      printf(\"%d\", result);\n8      return 0;\n9  }", correctLine: "6", correctedLine: "int result = a * b;", description: "This line is syntactically correct." },
  { id: "7", questionNo: 7, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int i;\n5      for (i = 0; i < 10; i++) {\n6          printf(\"%d\", i);\n7      }\n8      return 0;\n9  }", correctLine: "5", correctedLine: "for (i = 0; i < 10; i++) {", description: "The loop condition and increment should be written correctly." },
  { id: "8", questionNo: 8, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int a = 5;\n5      int b = 2;\n6      int result = a + b;\n7      printf(\"%d\", result);\n8      return 0;\n9  }", correctLine: "6", correctedLine: "int result = a + b;", description: "The arithmetic expression should match the required operation." },
  { id: "9", questionNo: 9, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int a = 10;\n5      printf(\"%d\", a)\n6      return 0;\n7  }", correctLine: "5", correctedLine: "printf(\"%d\", a);", description: "The semicolon is missing after the printf statement." },
  { id: "10", questionNo: 10, language: "C", code: "1  #include <stdio.h>\n2\n3  int main() {\n4      int x = 5;\n5      int y = 10;\n6      printf(\"%d\", x + y);\n7      return 0;\n8  }", correctLine: "6", correctedLine: "printf(\"%d\", x + y);", description: "Check the printf statement and required expression." },
];

const round2Questions = [
  { id: "1", questionNo: 1, language: "C", question: "Write a program to find the largest of two numbers.", starterCode: "", expectedAnswer: "Program should correctly compare two numbers and print the larger number.", testCases: "10 20 -> 20\n50 20 -> 50" },
  { id: "2", questionNo: 2, language: "C", question: "Write a program to check whether a number is even or odd.", starterCode: "", expectedAnswer: "Program should print Even for an even number and Odd for an odd number.", testCases: "10 -> Even\n7 -> Odd" },
  { id: "3", questionNo: 3, language: "C", question: "Write a program to calculate the sum of numbers from 1 to N.", starterCode: "", expectedAnswer: "Program should calculate 1 + 2 + ... + N correctly.", testCases: "5 -> 15\n10 -> 55" },
  { id: "4", questionNo: 4, language: "C", question: "Write a program to reverse an integer.", starterCode: "", expectedAnswer: "Program should reverse the digits of the given integer.", testCases: "1234 -> 4321\n500 -> 5" },
];

try {
  const createdAt = Timestamp.now();
  const batch = db.batch();
  for (const question of round1Questions) batch.set(db.collection("round1_questions").doc(question.id), { ...question, createdAt });
  for (const question of round2Questions) batch.set(db.collection("round2_questions").doc(question.id), { ...question, createdAt });
  batch.set(db.collection("event_settings").doc("current"), {
    round1Started: true, round2Started: false, round1Finished: false, round2Finished: false, updatedAt: createdAt,
  }, { merge: true });
  await batch.commit();
  console.log(`Migrated ${round1Questions.length} round 1 and ${round2Questions.length} round 2 questions.`);
} catch (error) {
  console.error("Legacy migration failed", error);
  process.exitCode = 1;
}