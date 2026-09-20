-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 20, 2026 at 11:25 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `blind_coding`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `event_settings`
--

CREATE TABLE `event_settings` (
  `id` int(11) NOT NULL,
  `round1_started` tinyint(1) NOT NULL DEFAULT 1,
  `round2_started` tinyint(1) NOT NULL DEFAULT 0,
  `round1_finished` tinyint(1) NOT NULL DEFAULT 0,
  `round2_finished` tinyint(1) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_settings`
--

INSERT INTO `event_settings` (`id`, `round1_started`, `round2_started`, `round1_finished`, `round2_finished`, `updated_at`) VALUES
(1, 1, 0, 1, 1, '2026-09-14 04:41:52');

-- --------------------------------------------------------

--
-- Table structure for table `round1_answers`
--

CREATE TABLE `round1_answers` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `error_line` varchar(50) NOT NULL,
  `corrected_line` text NOT NULL,
  `description` text NOT NULL,
  `score` int(11) NOT NULL DEFAULT 0,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `round1_answers`
--

INSERT INTO `round1_answers` (`id`, `user_id`, `question_id`, `error_line`, `corrected_line`, `description`, `score`, `submitted_at`) VALUES
(1, 1, 1, '6', 'int sum = a + b;', 'without semicolan', 10, '2026-09-13 14:44:31'),
(2, 1, 4, '6', 'printf(\"%d\", a + b);', 'divided by zero', 5, '2026-09-13 14:49:43'),
(3, 1, 2, '9', 'printf(\"Smaller\");', 'semicolan', 10, '2026-09-13 14:50:14'),
(4, 2, 1, '5', 'int sum = a + b', 'semicolon', 0, '2026-09-14 04:33:49');

-- --------------------------------------------------------

--
-- Table structure for table `round1_questions`
--

CREATE TABLE `round1_questions` (
  `id` int(11) NOT NULL,
  `question_no` int(11) NOT NULL,
  `language` varchar(50) NOT NULL DEFAULT 'C',
  `code` text NOT NULL,
  `correct_line` varchar(500) NOT NULL,
  `corrected_line` varchar(500) NOT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `round1_questions`
--

INSERT INTO `round1_questions` (`id`, `question_no`, `language`, `code`, `correct_line`, `corrected_line`, `description`, `created_at`) VALUES
(1, 1, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int a = 10;\r\n5      int b = 20;\r\n6      int sum = a + b\r\n7      printf(\"%d\", sum);\r\n8      return 0;\r\n9  }', '6', 'int sum = a + b;', 'The semicolon is missing at the end of the variable declaration.', '2026-09-13 14:36:26'),
(2, 2, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int a = 10;\r\n5      if (a > 5) {\r\n6          printf(\"Greater\");\r\n7      }\r\n8      else\r\n9          printf(\"Smaller\")\r\n10     return 0;\r\n11 }', '9', 'printf(\"Smaller\");', 'The printf statement is missing a semicolon.', '2026-09-13 14:36:26'),
(3, 3, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int i;\r\n5      for (i = 0; i < 5; i++) {\r\n6          printf(\"%d\", i);\r\n7      }\r\n8      return 0;\r\n9  }', '5', 'for (i = 0; i < 5; i++) {', 'This is a valid loop statement. For this question, replace the incorrect increment expression with the corrected one if your actual question uses an error.', '2026-09-13 14:36:26'),
(4, 4, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int a = 10;\r\n5      int b = 0;\r\n6      printf(\"%d\", a / b);\r\n7      return 0;\r\n8  }', '6', 'printf(\"%d\", a / b);', 'This question demonstrates a logical/runtime problem: division by zero must be prevented.', '2026-09-13 14:36:26'),
(5, 5, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int number = 10;\r\n5      if (number = 10) {\r\n6          printf(\"Ten\");\r\n7      }\r\n8      return 0;\r\n9  }', '5', 'if (number == 10) {', 'The equality operator == must be used for comparison instead of the assignment operator =.', '2026-09-13 14:36:26'),
(6, 6, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int a = 5;\r\n5      int b = 10;\r\n6      int result = a * b;\r\n7      printf(\"%d\", result);\r\n8      return 0;\r\n9  }', '6', 'int result = a * b;', 'This line is syntactically correct. Replace it with your intended debugging question if required.', '2026-09-13 14:36:26'),
(7, 7, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int i;\r\n5      for (i = 0; i < 10; i++) {\r\n6          printf(\"%d\", i);\r\n7      }\r\n8      return 0;\r\n9  }', '5', 'for (i = 0; i < 10; i++) {', 'The loop condition and increment should be written correctly.', '2026-09-13 14:36:26'),
(8, 8, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int a = 5;\r\n5      int b = 2;\r\n6      int result = a + b;\r\n7      printf(\"%d\", result);\r\n8      return 0;\r\n9  }', '6', 'int result = a + b;', 'The arithmetic expression should match the required operation.', '2026-09-13 14:36:26'),
(9, 9, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int a = 10;\r\n5      printf(\"%d\", a)\r\n6      return 0;\r\n7  }', '5', 'printf(\"%d\", a);', 'The semicolon is missing after the printf statement.', '2026-09-13 14:36:26'),
(10, 10, 'C', '1  #include <stdio.h>\r\n2\r\n3  int main() {\r\n4      int x = 5;\r\n5      int y = 10;\r\n6      printf(\"%d\", x + y);\r\n7      return 0;\r\n8  }', '6', 'printf(\"%d\", x + y);', 'Check the printf statement and ensure the required expression is used correctly.', '2026-09-13 14:36:26');

-- --------------------------------------------------------

--
-- Table structure for table `round2_answers`
--

CREATE TABLE `round2_answers` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `answer` text NOT NULL,
  `syntax_errors` int(11) NOT NULL DEFAULT 0,
  `logical_errors` int(11) NOT NULL DEFAULT 0,
  `syntax_penalty` int(11) NOT NULL DEFAULT 0,
  `logical_penalty` int(11) NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 25,
  `ai_feedback` text DEFAULT NULL,
  `evaluated` tinyint(1) NOT NULL DEFAULT 0,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `evaluated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `round2_answers`
--

INSERT INTO `round2_answers` (`id`, `user_id`, `question_id`, `answer`, `syntax_errors`, `logical_errors`, `syntax_penalty`, `logical_penalty`, `score`, `ai_feedback`, `evaluated`, `submitted_at`, `evaluated_at`) VALUES
(1, 1, 1, 'a=int(input(\"enter any number\"))\r\nb=int(input(\"enter any number\"))\r\nif(a>b):\r\n    print(\"a is greter\");\r\nelse:\r\n    print(\"b is greter\");', 0, 0, 0, 0, 25, 'AI API key is not configured.', 1, '2026-09-13 15:00:52', '2026-09-13 15:00:52'),
(4, 1, 2, 'a=int(input(\"enter any number\"))\r\nb=int(input(\"enter any number\"))\r\nif(a>b):\r\n    print(\"a is greter\");\r\nelse:\r\n    print(\"b is greter\")', 0, 0, 0, 0, 25, 'AI API key is not configured.', 1, '2026-09-13 14:58:15', '2026-09-13 14:58:15'),
(12, 1, 3, 'hv', 0, 0, 0, 0, 25, 'AI API key is not configured.', 1, '2026-09-13 15:01:01', '2026-09-13 15:01:01'),
(13, 2, 1, 'kjghadg', 0, 0, 0, 0, 25, 'AI API key is not configured.', 1, '2026-09-14 04:36:40', '2026-09-14 04:36:40');

-- --------------------------------------------------------

--
-- Table structure for table `round2_questions`
--

CREATE TABLE `round2_questions` (
  `id` int(11) NOT NULL,
  `question_no` int(11) NOT NULL,
  `language` varchar(50) NOT NULL DEFAULT 'C',
  `question` text NOT NULL,
  `starter_code` text NOT NULL,
  `expected_answer` text NOT NULL,
  `test_cases` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `round2_questions`
--

INSERT INTO `round2_questions` (`id`, `question_no`, `language`, `question`, `starter_code`, `expected_answer`, `test_cases`, `created_at`) VALUES
(1, 1, 'C', 'Write a program to find the largest of two numbers.', '', 'Program should correctly compare two numbers and print the larger number.', '10 20 -> 20\r\n50 20 -> 50', '2026-09-13 14:36:50'),
(2, 2, 'C', 'Write a program to check whether a number is even or odd.', '', 'Program should print Even for an even number and Odd for an odd number.', '10 -> Even\r\n7 -> Odd', '2026-09-13 14:36:50'),
(3, 3, 'C', 'Write a program to calculate the sum of numbers from 1 to N.', '', 'Program should calculate 1 + 2 + ... + N correctly.', '5 -> 15\r\n10 -> 55', '2026-09-13 14:36:50'),
(4, 4, 'C', 'Write a program to reverse an integer.', '', 'Program should reverse the digits of the given integer.', '1234 -> 4321\r\n500 -> 5', '2026-09-13 14:36:50');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `college_name` varchar(200) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `college_name`, `username`, `password`, `created_at`) VALUES
(1, 'hariharan', 'grace college', 'hari@gmail.com', '$2y$10$0eoE4UGN5.ebcsJVtFcMl.iez3fuF7.MmquMS497U4XzyXE3VIDr6', '2026-09-13 14:16:59'),
(2, 'mapla', 'grace college', 'mapla@gmail.com', '$2y$10$UNBA5GfLGKQp7aZKkA1yE.ZQsDC4xXAQBsGKkJTz3mMHgsxAehTeS', '2026-09-14 04:31:44');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `event_settings`
--
ALTER TABLE `event_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `round1_answers`
--
ALTER TABLE `round1_answers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_round1_answer` (`user_id`,`question_id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `round1_questions`
--
ALTER TABLE `round1_questions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `question_no` (`question_no`);

--
-- Indexes for table `round2_answers`
--
ALTER TABLE `round2_answers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_round2_answer` (`user_id`,`question_id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `round2_questions`
--
ALTER TABLE `round2_questions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `question_no` (`question_no`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `round1_answers`
--
ALTER TABLE `round1_answers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `round1_questions`
--
ALTER TABLE `round1_questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `round2_answers`
--
ALTER TABLE `round2_answers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `round2_questions`
--
ALTER TABLE `round2_questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `round1_answers`
--
ALTER TABLE `round1_answers`
  ADD CONSTRAINT `round1_answers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `round1_answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `round1_questions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `round2_answers`
--
ALTER TABLE `round2_answers`
  ADD CONSTRAINT `round2_answers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `round2_answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `round2_questions` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
