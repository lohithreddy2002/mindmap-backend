/**
 * Data structure for subjects and topics
 */
const subjects = [
  {
    id: 'react',
    name: 'React',
    topics: [
      {
        id: 'react-fundamentals',
        title: 'React Fundamentals',
        markdownPath: '/subjects/react/fundamentals.md'
      },
      {
        id: 'react-advanced-patterns',
        title: 'Advanced React Patterns',
        markdownPath: '/subjects/react/advanced-patterns.md'
      }
    ]
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    topics: [
      {
        id: 'typescript-basics',
        title: 'TypeScript Basics',
        markdownPath: '/subjects/typescript/basics.md'
      },
      {
        id: 'typescript-advanced-types',
        title: 'Advanced TypeScript Types',
        markdownPath: '/subjects/typescript/advanced-types.md'
      }
    ]
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    topics: [
      {
        id: 'javascript-es6',
        title: 'JavaScript ES6+',
        markdownPath: '/subjects/javascript/es6.md'
      },
      {
        id: 'javascript-async',
        title: 'Asynchronous JavaScript',
        markdownPath: '/subjects/javascript/async.md'
      }
    ]
  }
];

module.exports = subjects; 