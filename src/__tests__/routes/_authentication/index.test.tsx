import { screen, waitFor, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { AuthenticationContext } from "../../../contexts/authentication";
import { MemeFeedPage } from "../../../routes/_authentication/index";
import { renderWithRouter } from "../../utils";

beforeAll(() => {
  global.IntersectionObserver = class {
    constructor() { }
    observe() { }
    unobserve() { }
    disconnect() { }
  };
});

beforeEach(() => {
  // Mock container width to match REF_WIDTH (800px)
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
  });
  window.scrollTo = vi.fn();
});

describe("routes/_authentication/index", () => {
  describe("MemeFeedPage", () => {
    function renderMemeFeedPage() {
      return renderWithRouter({
        component: MemeFeedPage,
        Wrapper: ({ children }) => (
          <ChakraProvider>
            <QueryClientProvider client={new QueryClient()}>
              <AuthenticationContext.Provider
                value={{
                  state: {
                    isAuthenticated: true,
                    userId: "dummy_user_id",
                    token: "dummy_token",
                  },
                  authenticate: () => { },
                  signout: () => { },
                }}
              >
                {children}
              </AuthenticationContext.Provider>
            </QueryClientProvider>
          </ChakraProvider>
        ),
      });
    }

    it("should fetch the memes and display them with their comments", async () => {
      renderMemeFeedPage();

      await waitFor(() => {

        // We check that the right author's username is displayed
        expect(screen.getByTestId("meme-author-dummy_meme_id_1")).toHaveTextContent('dummy_user_1');

        // We check that the right meme's picture is displayed
        expect(screen.getByTestId("meme-picture-dummy_meme_id_1")).toHaveStyle({
          'background-image': 'url("https://dummy.url/meme/1")',
        });

        // We check that the right texts are displayed at the right positions
        const text1 = screen.getByTestId("meme-picture-dummy_meme_id_1-text-0");
        const text2 = screen.getByTestId("meme-picture-dummy_meme_id_1-text-1");

        // Get the container element
        const container = screen.getByTestId("meme-picture-dummy_meme_id_1");
        const containerWidth = container.offsetWidth;
        const scaleFactor = containerWidth / 800; // REF_WIDTH is 800

        // Verify the text wrapper elements have the correct scaled positions
        const text1Wrapper = text1.parentElement;
        const text2Wrapper = text2.parentElement;

        // Calculate expected positions (0 * scaleFactor and 100 * scaleFactor)
        const expectedText1Left = 0 * scaleFactor;
        const expectedText1Top = 0 * scaleFactor;
        const expectedText2Left = 100 * scaleFactor;
        const expectedText2Top = 100 * scaleFactor;

        // Get actual positions from computed style
        const text1Left = parseFloat(window.getComputedStyle(text1Wrapper!).left);
        const text1Top = parseFloat(window.getComputedStyle(text1Wrapper!).top);
        const text2Left = parseFloat(window.getComputedStyle(text2Wrapper!).left);
        const text2Top = parseFloat(window.getComputedStyle(text2Wrapper!).top);

        // Allow small floating point differences
        expect(text1Left).toBeCloseTo(expectedText1Left);
        expect(text1Top).toBeCloseTo(expectedText1Top);
        expect(text2Left).toBeCloseTo(expectedText2Left);
        expect(text2Top).toBeCloseTo(expectedText2Top);

        // We check that the right description is displayed
        expect(screen.getByTestId("meme-description-dummy_meme_id_1")).toHaveTextContent('dummy meme 1');

        // We check that the right number of comments is displayed
        expect(screen.getByTestId("meme-comments-count-dummy_meme_id_1")).toHaveTextContent('3 comments');

        // Then, click the toggle element to show comments
        fireEvent.click(screen.getByTestId("meme-comments-section-dummy_meme_id_1"));

        // We check that the right comments with the right authors are displayed
        expect(screen.getByTestId("meme-comment-content-dummy_meme_id_1-dummy_comment_id_1")).toHaveTextContent('dummy comment 1');
        expect(screen.getByTestId("meme-comment-author-dummy_meme_id_1-dummy_comment_id_1")).toHaveTextContent('dummy_user_1');

        expect(screen.getByTestId("meme-comment-content-dummy_meme_id_1-dummy_comment_id_2")).toHaveTextContent('dummy comment 2');
        expect(screen.getByTestId("meme-comment-author-dummy_meme_id_1-dummy_comment_id_2")).toHaveTextContent('dummy_user_2');

        expect(screen.getByTestId("meme-comment-content-dummy_meme_id_1-dummy_comment_id_3")).toHaveTextContent('dummy comment 3');
        expect(screen.getByTestId("meme-comment-author-dummy_meme_id_1-dummy_comment_id_3")).toHaveTextContent('dummy_user_3');
      });
    });

    it("should display the new comment after user has added it", async () => {
      renderMemeFeedPage();

      // Wait for and click the toggle to open comments
      const toggle = await screen.findByTestId("meme-comments-section-dummy_meme_id_1");
      fireEvent.click(toggle);

      // Wait for the input field to appear
      const input = await screen.findByTestId("add-comment-input-field-dummy_meme_id_1");

      // Type and submit comment
      fireEvent.change(input, { target: { value: "my new comment" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
      fireEvent.submit(input.closest("form"));

      await waitFor(() => {
        expect(screen.getByText("my new comment")).toBeInTheDocument();
      });

    });

  });
});
