import { jwtDecode } from "jwt-decode";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect
} from "react";

export type AuthenticationState =
  | {
      isAuthenticated: true;
      token: string;
      userId: string;
    }
  | {
      isAuthenticated: false;
    };

export type Authentication = {
  state: AuthenticationState;
  authenticate: (token: string) => void;
  signout: () => void;
};

export const AuthenticationContext = createContext<Authentication | undefined>(
  undefined,
);

export const AuthenticationProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [state, setState] = useState<AuthenticationState>({
    isAuthenticated: false,
  });

  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const decoded = jwtDecode<{ exp?: number }>(token);
      // Check if expiration time exists and if it's in the past
      if (decoded.exp === undefined) return false; // If no expiration, consider it valid
      return decoded.exp * 1000 < Date.now();
    } catch (error) {
      // If there's an error decoding, consider it expired
      return true;
    }
  }, []);

  const validateAndSetAuthState = useCallback((token: string) => {
    if (isTokenExpired(token)) {
      localStorage.removeItem("authToken");
      setState({ isAuthenticated: false });
      return false;
    }
    
    setState({
      isAuthenticated: true,
      token,
      userId: jwtDecode<{ id: string }>(token).id,
    });
    return true;
  }, [isTokenExpired]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      validateAndSetAuthState(token);
    }
  }, [validateAndSetAuthState]);


  const authenticate = useCallback(
    (token: string) => {
      localStorage.setItem("authToken", token);
      validateAndSetAuthState(token)
    },
    [validateAndSetAuthState]
  );

  const signout = useCallback(() => {
    localStorage.removeItem("authToken");
    setState({ isAuthenticated: false });
  }, [setState]);

  const contextValue = useMemo(
    () => ({ state, authenticate, signout }),
    [state, authenticate, signout],
  );

  return (
    <AuthenticationContext.Provider value={contextValue}>
      {children}
    </AuthenticationContext.Provider>
  );
};

export function useAuthentication() {
  const context = useContext(AuthenticationContext);
  if (!context) {
    throw new Error(
      "useAuthentication must be used within an AuthenticationProvider",
    );
  }
  return context;
}

export function useAuthToken() {
  const { state } = useAuthentication();
  if (!state.isAuthenticated) {
    throw new Error("User is not authenticated");
  }
  return state.token;
}
