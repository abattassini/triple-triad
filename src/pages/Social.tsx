import { Box, Container, Paper, Typography } from '@mui/material';
import { FiTool, FiUsers } from 'react-icons/fi';
import './Social.scss';

/**
 * Latin placeholder text for this page's long filler block: the classic lorem ipsum passage in six chunks. It is here
 * only to make the page taller than the viewport — none of it is page copy.
 *
 * To remove it: delete `LOREM`, `FILLER_SECTIONS`, the `social-filler` block in the markup, and the `.social-filler`
 * styles in `Social.scss`.
 */
const LOREM: string[] = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt, neque porro quisquam est qui dolorem ipsum quia dolor sit amet.',
  'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa.',
  'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis.',
];

/** Each entry renders the whole passage again, so the page scrolls well past a screen. */
const FILLER_SECTIONS = [1, 2, 3];

/**
 * Social: the chrome's Social entry. It has nothing behind it yet, so it says so rather than pretending otherwise —
 * the request asks for a page that "shows that the page is under construction".
 *
 * Below the panel it also carries a long latin text block (see `LOREM` and `.social-filler`), which makes the page
 * taller than the viewport. It is placeholder copy rather than real content — `LOREM` says how to take it back out.
 */
export const Social: React.FC = () => (
  <Box className="social app-chrome-page">
    <Container className="social-container">
      <Box className="social-content">
        <Typography variant="h4" className="social-title">
          <FiUsers className="page-title-icon" aria-hidden="true" /> Social
        </Typography>
        <Typography variant="body1" className="social-subtitle">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore.
        </Typography>

        <Paper elevation={3} className="social-coming-soon">
          <Typography variant="h5" className="social-coming-soon__title">
            <FiTool className="social-coming-soon__title-icon" aria-hidden="true" /> Under
            construction
          </Typography>
          <Typography variant="body2" className="social-coming-soon__caption">
            The Social page is not built yet — check back later.
          </Typography>
        </Paper>

        {/* The long latin block: enough text that the page scrolls. Placeholder copy — see the comment above `LOREM`. */}
        <Box className="social-filler">
          {FILLER_SECTIONS.map(section => (
            <Box key={section} className="social-filler__section">
              <Typography variant="h5" className="social-filler__heading">
                Lorem ipsum — pars {section}
              </Typography>
              {LOREM.map((paragraph, index) => (
                <Typography key={index} variant="body2" className="social-filler__paragraph">
                  {paragraph}
                </Typography>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Container>
  </Box>
);
