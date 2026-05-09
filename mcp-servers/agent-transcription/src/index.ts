import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeSchema } from './db/schema.js';
import { closeDatabase } from './db/database.js';
import { transcribeFile } from './tools/transcribe.js';
import { transcribeWithSummary } from './tools/transcribe-summary.js';
import { transcriptList } from './tools/transcript-list.js';
import { transcriptGet } from './tools/transcript-get.js';

const server = new McpServer({
  name: 'agent-transcription',
  version: '1.0.0',
  description: 'Offline audio/video transcription using whisper.cpp CLI with SQLite storage',
});

// Initialize database schema
initializeSchema();

// Tool: transcribe
server.tool(
  'transcribe',
  'Transcribe an audio or video file to text using whisper.cpp. Supports mp3, wav, flac, ogg, mp4, mkv, webm, mov, avi. Video files are automatically converted to audio first via ffmpeg.',
  {
    file_path: z.string().describe('Absolute path to the audio or video file'),
    model: z.enum(['tiny', 'base', 'small', 'medium', 'large']).optional().describe('Whisper model size (default: base). Larger models are slower but more accurate.'),
    language: z.string().optional().describe('Language code (e.g., en, es, fr). Auto-detected if omitted.'),
    output_format: z.enum(['text', 'srt', 'vtt', 'json']).optional().describe('Output format (default: text)'),
  },
  async (params) => {
    try {
      const result = await transcribeFile({
        file_path: params.file_path,
        model: params.model,
        language: params.language,
        output_format: params.output_format,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: transcribe_summary
server.tool(
  'transcribe_summary',
  'Transcribe an audio or video file and generate an extractive text summary. The summary extracts the most content-rich sentences from the beginning, middle, and end of the transcript. No external API calls are made.',
  {
    file_path: z.string().describe('Absolute path to the audio or video file'),
    model: z.enum(['tiny', 'base', 'small', 'medium', 'large']).optional().describe('Whisper model size (default: base). Larger models are slower but more accurate.'),
    language: z.string().optional().describe('Language code (e.g., en, es, fr). Auto-detected if omitted.'),
    output_format: z.enum(['text', 'srt', 'vtt', 'json']).optional().describe('Output format (default: text)'),
  },
  async (params) => {
    try {
      const result = await transcribeWithSummary({
        file_path: params.file_path,
        model: params.model,
        language: params.language,
        output_format: params.output_format,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: transcript_list
server.tool(
  'transcript_list',
  'List stored transcriptions with pagination, ordered by most recent first.',
  {
    limit: z.number().min(1).max(100).optional().describe('Maximum results to return (default: 20)'),
    offset: z.number().min(0).optional().describe('Number of records to skip for pagination (default: 0)'),
  },
  async (params) => {
    try {
      const result = transcriptList({
        limit: params.limit,
        offset: params.offset,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Tool: transcript_get
server.tool(
  'transcript_get',
  'Get a single transcription by ID, including the full transcript text and any timestamp chunks.',
  {
    id: z.string().describe('The transcription ID to retrieve'),
  },
  async (params) => {
    try {
      const result = transcriptGet({ id: params.id });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Transcription Agent MCP server running on stdio');
}

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error starting agent-transcription server:', error);
  process.exit(1);
});
